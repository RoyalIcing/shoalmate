
export const parent = Symbol("parent");

type VariableTypeBuilder<Type> = (a: Type) => { [x: string]: Type };
export type Variable<Type = any> = symbol & (VariableTypeBuilder<Type>);
export function variable<Type = any>(description: string | number): Variable<Type> {
  // return Symbol(description);
  const prop = Symbol(description);

  function result(a: Type) {
    return { [prop]: a };
  }
  result[Symbol.toPrimitive] = () => prop;

  return result as unknown as Variable<Type>;
}

export function compound<Types = any>(...values: Array<{ [x: string]: Types }>): { [x: string]: Types } {
  return Object.assign({}, ...values);
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

export function changing<Value = any>(prop: Variable<Value>, transform: (a: Value) => Value): { [x: string]: () => Value; } {
  return {
    [prop]() {
      const current: Value = this[parent][prop];
      return transform(current);
    }
  }
}

export function adding(prop: Variable<number>, amount: number): { [x: string]: () => number; } {
  return {
    [prop]() {
      const current: number = this[parent][prop];
      return current + amount;
    }
  }
}

export function prepending<Value = any>(prop: Variable<Array<Value>>, value: Value): { [prop: string]: () => Generator<Value, void, undefined>; } {
  return {
    *[prop]() {
      const current: Array<Value> = this[parent][prop];
      yield value;
      yield* current;
    }
  }
}

export function appending<Value = any>(prop: Variable<Array<Value>>, value: Value): { [prop: string]: () => Generator<Value, void, undefined>; } {
  return {
    *[prop]() {
      const current: Array<Value> = this[parent][prop];
      yield* current;
      yield value;
    }
  }
}

export interface Cursor { readonly id: symbol };

function makeCursor(value: string | number): Cursor {
  return Object.freeze({ id: Symbol(value) });
}

function getCursorNumber(cursor: Cursor): number {
  return parseFloat(cursor.id.description ?? "-1") || -1;
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
  uniqueCount(cursors: Iterable<Cursor>): number;
  mostRecent(cursors: Iterable<Cursor>): Cursor;
}

export function makeClock(): Clock {
  let vectorClock = 0;

  return {
    currentCursor: makeCursor(vectorClock),
    reader() {
      return readStateFor(this.currentCursor);
    },
    writer() {
      const initial = this.currentCursor;
      return (key, value) => {
        if (initial !== this.currentCursor) {
          // Ignore
          return;
        }
        
        return setStateFor(this.currentCursor)(key, value);
      }
    },
    advance() {
      vectorClock++;
      const newCursor = makeCursor(vectorClock);
      copyStateFromTo(this.currentCursor, newCursor);
      this.currentCursor = newCursor;
    },
    uniqueCount(cursors: Iterable<Cursor>) {
      return (new Set(cursors)).size;
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
