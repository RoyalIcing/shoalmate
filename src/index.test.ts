import { declare, fork, parent, variable, adding, prepending, appending, changing, makeClock, readStateFor, setStateFor } from "./index";

describe("declare()", () => {
  const Counter = variable("Counter");

  describe("single number property", () => {
    const c = declare({
      [Counter]: 0,
    });
  
    it("is frozen", () => {
      expect(Object.isFrozen(c)).toBe(true);
    });
  
    it("can read property", () => {
      expect(c[Counter]).toEqual(0);
    });
  
    it("has no string keys", () => {
      expect(Object.keys(c)).toHaveLength(0);
    });
  
    it("has symbol properties", () => {
      expect(Object.getOwnPropertySymbols(c)).toHaveLength(1);
    });

    it("JSON stringifies into empty object", () => {
      expect(JSON.stringify(c)).toEqual("{}");
    });
  });

  describe("single number property using call syntax", () => {
    const c = declare(Counter(42));
  
    it("is frozen", () => {
      expect(Object.isFrozen(c)).toBe(true);
    });
  
    it("can read property", () => {
      expect(c[Counter]).toEqual(42);
    });
  
    it("has no string keys", () => {
      expect(Object.keys(c)).toHaveLength(0);
    });
  
    it("has symbol properties", () => {
      expect(Object.getOwnPropertySymbols(c)).toHaveLength(1);
    });

    it("JSON stringifies into empty object", () => {
      expect(JSON.stringify(c)).toEqual("{}");
    });
  });

  describe("calculated property", () => {
    const DoubleCounter = variable("DoubleCounter");
    
    const c = declare({
      [Counter]: 7,
      [DoubleCounter]() {
        return this[Counter] * 2;
      }
    });
  
    it("can read property", () => {
      expect(c[Counter]).toEqual(7);
    });

    it("can read calculated property", () => {
      expect(c[DoubleCounter]).toEqual(14);
    });
  
    it("has no string keys", () => {
      expect(Object.keys(c)).toHaveLength(0);
    });
  
    it("has symbol properties", () => {
      expect(Object.getOwnPropertySymbols(c)).toHaveLength(2);
    });
  });
});

describe("fork()", () => {
  const Counter = variable("Counter");
  const Pi = variable("Pi");

  describe("changing existing property", () => {
    const c1 = declare({
      [Counter]: 0,
      [Pi]: 3.14,
    });
    const c2 = fork(c1, { [Counter]: 1 });

    it("has reference to parent", () => {
      expect(c2[parent]).toBe(c1);
    })

    it("is frozen", () => {
      expect(Object.isFrozen(c2)).toBe(true);
    });
  
    it("has property with new value", () => {
      expect(c2[Counter]).toEqual(1);
    });

    it("kept unchanged properties", () => {
      expect(c2[Pi]).toEqual(3.14);
    });
  
    it("has no string keys", () => {
      expect(Object.keys(c2)).toHaveLength(0);
    });
  
    it("has symbol properties, 1 for new property, 1 for parent reference", () => {
      expect(Object.getOwnPropertySymbols(c2)).toHaveLength(2);
    });
    
    it("JSON stringifies into empty object", () => {
      expect(JSON.stringify(c2)).toEqual("{}");
    });
  });

  describe("changing source of calculated property", () => {
    const DoubleCounter = variable("DoubleCounter");
    
    const c1 = declare({
      [Counter]: 7,
      [DoubleCounter]() {
        return this[Counter] * 2;
      }
    });
    const c2 = fork(c1, { [Counter]: 11 });
  
    it("has property with new value", () => {
      expect(c2[Counter]).toEqual(11);
    });

    it("calculates based on new source value", () => {
      expect(c2[DoubleCounter]).toEqual(22);
    });
  });

  describe("incrementing number with changing()", () => {
    const c1 = declare({ [Counter]: 3 });
    const c2 = fork(c1, {
      [Counter]() {
        return this[parent][Counter] + 1;
      }
    });
    const c3 = fork(c2, changing(Counter, n => n + 1));
  
    it("adds up", () => {
      expect(c2[Counter]).toEqual(4);
      expect(c3[Counter]).toEqual(5);
    });
  });
  
  describe("incrementing number with adding()", () => {
    const c1 = declare({ [Counter]: 3 });
    const c2 = fork(c1, {
      [Counter]() {
        return this[parent][Counter] + 1;
      }
    });
    const c3 = fork(c2, adding(Counter, 1));
  
    it("adds up", () => {
      expect(c2[Counter]).toEqual(4);
      expect(c3[Counter]).toEqual(5);
    });
  });

  describe("appending to array", () => {
    const Todos = variable("Todos");
    
    const c1 = declare({
      [Todos]: ["first", "second"],
    });
    const c2 = fork(c1, appending(Todos, "end"));
  
    it("yields with value appended", () => {
      expect(Array.from(c2[Todos])).toEqual(["first", "second", "end"]);
    });
  });

  describe("prepending to array", () => {
    const Todos = variable("Todos");
    
    const c1 = declare({
      [Todos]: ["first", "second"],
    });
    const c2 = fork(c1, prepending(Todos, "start"));
  
    it("yields with value prepended", () => {
      expect(Array.from(c2[Todos])).toEqual(["start", "first", "second"]);
    });
  });
});

describe("Clocks", () => {
  it("has no state for new clocks and new symbol", () => {
    const clock = makeClock();
    expect(readStateFor(clock.currentCursor)(Symbol())).toBeUndefined();
  });

  it("stores state", () => {
    const clock = makeClock();
    const key = Symbol();
    setStateFor(clock.currentCursor, key, 7);
    
    expect(readStateFor(clock.currentCursor)(key)).toBe(7);
    expect(clock.reader()(key)).toBe(7);
  });

  it("changes cursor after advancing", () => {
    const clock = makeClock();
    
    const cursorA = clock.currentCursor;
    clock.advance();
    expect(clock.currentCursor).not.toBe(cursorA);
  });

  it("remembers previously set state after advancing", () => {
    const clock = makeClock();
    const key = Symbol();
    const reader = clock.reader();
    setStateFor(clock.currentCursor, key, 7);
    clock.advance();
    expect(readStateFor(clock.currentCursor)(key)).toBe(7);
    
    expect(reader(key)).toBe(7);
    expect(clock.reader()(key)).toBe(7);
  });

  it("copies state after advancing", () => {
    const clock = makeClock();
    const key = Symbol();
    const reader = clock.reader();
    const cursorA = clock.currentCursor;
    setStateFor(cursorA, key, 7);
    clock.advance();
    
    const cursorB = clock.currentCursor;
    setStateFor(cursorB, key, 9);

    expect(readStateFor(cursorA)(key)).toBe(7);
    expect(readStateFor(clock.currentCursor)(key)).toBe(9);
    
    expect(reader(key)).toBe(7);
    expect(clock.reader()(key)).toBe(9);
  });

  /*it("copies state after advancing", () => {
    const clock = makeClock();
    const key = Symbol();
    const cursorA = clock.currentCursor;
    setState(key, 7);
    // cursorA[key] = 9;
    // cursorA.freeze();
    
    clock.advance();

    setState(key, 9);
    // cursorA[key] = 9;

    expect(readStateFor(cursorA, key)).toBe(7);
    expect(readStateFor(clock.currentCursor, key)).toBe(9);
  });*/
})
