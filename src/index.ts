export const Parent = Symbol("parent");

type VariableTypeBuilder<Type> = (a: Type | ((source: any) => Type)) => { [x: string]: Type };
export type Variable<Type = any> = symbol & (VariableTypeBuilder<Type>);
export type VariableValue<V extends Variable> = V extends VariableTypeBuilder<infer Value> ? Record<symbol, Value> : never;

const field = Symbol("field");
interface Field<Value> {
  [field]: Value;
}

const DefaultValue = Symbol("default");

export function variable<Type = any>(description: string | number, defaultValue: Type): Variable<Type> {
  // return Symbol(description);
  const prop = Symbol(description);

  function result(a: Readonly<Type | ((source: any) => Type)>) {
    if (typeof a === 'function') {
      return Object.freeze({
        [prop]() {
          return a.call(this, this);
        }
      })
    } else {
      return Object.freeze({ [prop]: a });
    }
  }
  result[Symbol.toPrimitive] = () => prop;
  result[DefaultValue] = defaultValue;

  return result as unknown as Variable<Type>;
}

export function struct<Fields extends Array<Variable>>(description: string | number, ...fields: Fields): Variable<{ [i in keyof Fields]: Fields[i] extends Variable<infer Value> ? { [x: string]: Value } : void }> {
  const prop = Symbol(description);

  function result(values: Fields extends Array<Variable<infer V>> ? V : never) {
    if (Array.isArray(values)) {
      return create(compound(...(values as any[])));
    } else {
      return null;
    }
  }
  result[Symbol.toPrimitive] = () => prop;

  return result as unknown as any;
}

export function compound<Types = any>(...values: Array<{ [x: string]: Types }>): { [x: string]: Types } {
  return Object.freeze(Object.assign({}, ...values));
}

function defineInternal(into: object, properties: Readonly<Record<Variable, any>>) {
  for (const prop of Object.getOwnPropertySymbols(properties)) {
    if (typeof properties[prop] === 'function') {
      Object.defineProperty(into, prop, {
        enumerable: true,
        // get() {
        //   return properties[prop].call(this);
        // },
        get: properties[prop],
      });
    } else {
      Object.defineProperty(into, prop, { value: Object.freeze(properties[prop]), enumerable: true });
    }
  }
}

export function create(properties: Readonly<Record<Variable, any>>): typeof properties {
  const result = {};
  defineInternal(result, properties);
  return Object.freeze(result);
}

export function fork(source: Readonly<Record<Variable, any>>, changes: Readonly<Record<Variable, any>>): typeof source {
  const result = Object.create(source);
  defineInternal(result, changes);
  Object.defineProperty(result, Parent, { value: source, enumerable: true });
  // Object.setPrototypeOf(result, source);
  return Object.freeze(result);
}

export function changing<Value = any, Output = any>(prop: Variable<Value>, transform: (a: Value) => Output): { [x: string]: () => Output; } {
  return Object.freeze({
    [prop]() {
      const current: Value = this[Parent][prop];
      return transform(current);
    }
  });
}

export function adding(prop: Variable<number>, amount: number): { [x: string]: () => number; } {
  return Object.freeze({
    [prop]() {
      const current: number = this[Parent][prop];
      return current + amount;
    }
  });
}

export function prepending<Value = any>(prop: Variable<Iterable<Value>>, value: Value): { [prop: string]: () => Generator<Value, void, undefined>; } {
  return Object.freeze({
    *[prop]() {
      const current: Iterable<Value> = this[Parent][prop];
      yield value;
      yield* current;
    }
  });
}

export function appending<Value = any>(prop: Variable<Iterable<Value>>, value: Value): { [prop: string]: () => Generator<Value, void, undefined>; } {
  return Object.freeze({
    *[prop]() {
      const current: Iterable<Value> = this[Parent][prop];
      yield* current;
      yield value;
    }
  });
}

export function mapping<Value = any, Output = any>(prop: Variable<Iterable<Value>>, transform: (a: Value) => Output): { [prop: string]: () => Generator<Output, void, undefined>; } {
  return Object.freeze({
    *[prop]() {
      const current: Iterable<Value> = this[Parent][prop];
      for (const value of current) {
        yield transform(value);
      }
    }
  });
}

function flatten<Value>(value: Value | undefined, field: Variable<Value>): Value | undefined {
  if (Array.isArray(field[DefaultValue]) && value !== undefined && value[Symbol.iterator] !== undefined) {
    return Array.from(value as unknown as Iterable<any>) as unknown as Value;
  } else {
    return value;
  }
}

export function createHistory<Value>(initial: Readonly<Record<Variable<Value>, any>>) {
  const stack: Array<Readonly<Record<Variable<Value>, any>>> = [initial];
  let currentIndex = 0;

  return Object.seal({
    read<Type>(field: Variable<Type>): Type {
      return flatten(stack[currentIndex][field], field);
    },
    readAt<Type>(index: number, field: Variable<Type>): Type {
      return flatten(stack[index] === undefined ? undefined : stack[index][field], field);
    },
    push(changes: Readonly<Record<Variable, any>>): void {
      stack.splice(currentIndex + 1);
      stack.push(fork(stack[currentIndex], changes));
      currentIndex++;
    },
    get canUndo(): boolean { return currentIndex > 0; },
    get canRedo(): boolean { return currentIndex + 1 < stack.length; },
    undo() {
      currentIndex = Math.max(0, currentIndex - 1);
    },
    redo() {
      currentIndex = Math.min(currentIndex + 1, stack.length - 1);
    }
  });
}

/////////

export const cursorSymbol = Symbol("cursor");

export interface Cursor { readonly description: string, readonly value: number };

function makeCursor(value: number): Cursor {
  return Object.freeze(Object.assign(Object(Symbol(value)), { value }));
}

function getCursorNumber(cursor: Cursor): number {
  return parseFloat(cursor.description ?? "-1") || -1;
}

const sharedState = new WeakMap<Cursor, Map<symbol, any>>();

export interface Clock {
  readonly currentCursor: Cursor;
  reader(): (key: symbol) => unknown | undefined;
  writer(): (key: symbol, value: any) => unknown | undefined;
  advance(): void;
  uniqueCount(cursors: Iterable<Cursor | Function>): number;
  mostRecent(cursors: Iterable<Cursor>): Cursor;
}

export function makeClock(): Clock {
  let currentCursor = makeCursor(0);

  return Object.seal({
    get currentCursor(): Cursor {
      return currentCursor;
    },
    reader(): (key: symbol) => unknown {
      const cursor = currentCursor;
      const f = readSharedStateFor(cursor);
      f[Symbol.toPrimitive] = () => cursor;
      f[cursorSymbol] = () => cursor;
      return f;
    },
    writer(): (key: symbol, value: any) => void {
      const cursor = currentCursor;
      const f = (key, value) => {
        if (cursor !== currentCursor) {
          // Ignore
          return;
        }
        
        setSharedStateFor(currentCursor)(key, value);
      }
      f[Symbol.toPrimitive] = () => cursor;
      f[cursorSymbol] = () => cursor;
      return f;
    },
    advance(): void {
      const newCursor = makeCursor(currentCursor.value + 1);
      copySharedStateFromTo(currentCursor, newCursor);
      currentCursor = newCursor;
    },
    uniqueCount(cursors: Iterable<Cursor | Function>): number {
      const unique = new Set();
      for (const s of cursors) {
        unique.add(s[cursorSymbol]());
      }
      return unique.size;
    },
    mostRecent(cursors: Iterable<Cursor>): Cursor {
      const array = Array.from(cursors);
      if (array.length === 0) {
        throw new Error("Must pass non-empty iterable to mostRecent()");
      }
      return array.reduce((candidate, next) => {
        if (getCursorNumber(next) > getCursorNumber(candidate)) {
          return next;
        }
        return candidate;
      })
    }
  });
}

function copySharedStateFromTo(cursorA: Cursor, cursorB: Cursor): void {
  const state = sharedState.get(cursorA);
  const copiedState = state === undefined ? new Map() : new Map(state);
  sharedState.set(cursorB, copiedState);
}

export function readSharedStateFor(cursor: Cursor): (key: symbol) => any | undefined {
  return key => {
    const state = sharedState.get(cursor);
    return state?.get(key);
  }
}

export function setSharedStateFor(cursor: Cursor): (key: symbol, value: any) => void {
  return (key, value) => {
    let state = sharedState.get(cursor);
    if (state === undefined) {
      state = new Map();
      state.set(key, value);
      sharedState.set(cursor, state);
    } else {
      state.set(key, value);
    }
  }
}

/*export function updateStateFor(cursor: Cursor, key: symbol, value: any) {
  let state = sharedState.get(cursor);
  if (state === undefined) {
    state = new Map();
    state.set(key, value);
    sharedState.set(cursor, state);
  } else {
    state.set(key, value);
  }
}*/
