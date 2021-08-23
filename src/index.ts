
export const parent = Symbol("parent");

type VariableTypeBuilder<Type> = (a: Type) => { [x: string]: Type };
export type Variable<Type = any> = symbol & (VariableTypeBuilder<Type>);
export function variable<Type = any>(description: string | number): Variable<Type> {
  // return Symbol(description);
  const prop = Symbol(description);

  function result(a: Type) {
    return Object.freeze({ [prop]: a });
  }
  result[Symbol.toPrimitive] = () => prop;

  return result as unknown as Variable<Type>;
}

export function compound<Types = any>(...values: Array<{ [x: string]: Types }>): { [x: string]: Types } {
  return Object.freeze(Object.assign({}, ...values));
}

function defineInternal(into: object, properties: Readonly<Record<Variable, any>>) {
  for (const prop of Object.getOwnPropertySymbols(properties)) {
    if (typeof properties[prop] === 'function') {
      Object.defineProperty(into, prop, {
        enumerable: true,
        get() {
          return properties[prop].call(this);
        },
      });
    } else {
      Object.defineProperty(into, prop, { value: Object.freeze(properties[prop]), enumerable: true });
    }
  }
}

export function declare(properties: Readonly<Record<Variable, any>>): typeof properties {
  const result = {};
  defineInternal(result, properties);
  return Object.freeze(result);
}

export function fork(source: Readonly<Record<Variable, any>>, changes: Readonly<Record<Variable, any>>): typeof source {
  const result = Object.create(source);
  defineInternal(result, changes);
  Object.defineProperty(result, parent, { value: source, enumerable: true });
  // Object.setPrototypeOf(result, source);
  return Object.freeze(result);
}

export function changing<Value = any, Output = any>(prop: Variable<Value>, transform: (a: Value) => Output): { [x: string]: () => Output; } {
  return Object.freeze({
    [prop]() {
      const current: Value = this[parent][prop];
      return transform(current);
    }
  });
}

export function adding(prop: Variable<number>, amount: number): { [x: string]: () => number; } {
  return Object.freeze({
    [prop]() {
      const current: number = this[parent][prop];
      return current + amount;
    }
  });
}

export function prepending<Value = any>(prop: Variable<Iterable<Value>>, value: Value): { [prop: string]: () => Generator<Value, void, undefined>; } {
  return Object.freeze({
    *[prop]() {
      const current: Iterable<Value> = this[parent][prop];
      yield value;
      yield* current;
    }
  });
}

export function appending<Value = any>(prop: Variable<Iterable<Value>>, value: Value): { [prop: string]: () => Generator<Value, void, undefined>; } {
  return Object.freeze({
    *[prop]() {
      const current: Iterable<Value> = this[parent][prop];
      yield* current;
      yield value;
    }
  });
}

export function mapping<Value = any, Output = any>(prop: Variable<Iterable<Value>>, transform: (a: Value) => Output): { [prop: string]: () => Generator<Output, void, undefined>; } {
  return Object.freeze({
    *[prop]() {
      const current: Iterable<Value> = this[parent][prop];
      for (const value of current) {
        yield transform(value);
      }
    }
  });
}

export const cursorSymbol = Symbol("cursor");

export interface Cursor { readonly description: string };

function makeCursor(value: string | number): Cursor {
  return Object.freeze(Object(Symbol(value)));
}

function getCursorNumber(cursor: Cursor): number {
  return parseFloat(cursor.description ?? "-1") || -1;
}

const sharedState = new WeakMap<Cursor, Map<symbol, any>>();

function copyStateFromTo(cursorA: Cursor, cursorB: Cursor): void {
  const state = sharedState.get(cursorA);
  const copiedState = state === undefined ? new Map() : new Map(state);
  sharedState.set(cursorB, copiedState);
}

export interface Clock {
  readonly currentCursor: Cursor;
  reader(): (key: symbol) => unknown | undefined;
  writer(): (key: symbol, value: any) => unknown | undefined;
  advance(): void;
  uniqueCount(cursors: Iterable<Cursor | Function>): number;
  mostRecent(cursors: Iterable<Cursor>): Cursor;
}

export function makeClock(): Clock {
  let vectorClock = 0;

  return {
    currentCursor: makeCursor(vectorClock),
    reader() {
      const cursor = this.currentCursor;
      const f = readStateFor(cursor);
      f[Symbol.toPrimitive] = () => cursor;
      f[cursorSymbol] = () => cursor;
      return f;
    },
    writer() {
      const cursor = this.currentCursor;
      const f = (key, value) => {
        if (cursor !== this.currentCursor) {
          // Ignore
          return;
        }
        
        return setStateFor(this.currentCursor)(key, value);
      }
      f[Symbol.toPrimitive] = () => cursor;
      f[cursorSymbol] = () => cursor;
      return f;
    },
    advance() {
      vectorClock++;
      const newCursor = makeCursor(vectorClock);
      copyStateFromTo(this.currentCursor, newCursor);
      this.currentCursor = newCursor;
    },
    uniqueCount(cursors: Iterable<Cursor | Function>) {
      const unique = new Set();
      for (const s of cursors) {
        unique.add(s[Symbol.toPrimitive]());
      }
      return unique.size;
    },
    mostRecent(cursors: Iterable<Cursor>) {
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
  };
}

export function readStateFor(cursor: Cursor): (key: symbol) => any | undefined {
  return key => {
    const state = sharedState.get(cursor);
    return state?.get(key);
  }
}

export function setStateFor(cursor: Cursor): (key: symbol, value: any) => void {
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
