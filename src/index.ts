
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
