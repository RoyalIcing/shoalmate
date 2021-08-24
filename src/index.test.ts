import {
  create,
  fork,
  Parent,
  variable,
  compound,
  cursorSymbol,
  adding,
  prepending,
  appending,
  changing,
  makeClock,
  readStateFor,
  setStateFor,
  mapping,
  struct,
  VariableValue,
  createHistory,
} from "./index";

describe("declare()", () => {
  const Counter = variable("Counter", 0);

  describe("single number property", () => {
    const c = create({
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
    const c = create(Counter(42));

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

  describe("compound", () => {
    const Other = variable("Other", 0);

    const c = create(compound(Counter(42), Other(7)));

    it("is frozen", () => {
      expect(Object.isFrozen(c)).toBe(true);
    });

    it("can read properties", () => {
      expect(c[Counter]).toEqual(42);
      expect(c[Other]).toEqual(7);
    });

    it("has no string keys", () => {
      expect(Object.keys(c)).toHaveLength(0);
    });

    it("has symbol properties", () => {
      expect(Object.getOwnPropertySymbols(c)).toHaveLength(2);
    });

    it("JSON stringifies into empty object", () => {
      expect(JSON.stringify(c)).toEqual("{}");
    });
  });

  describe("calculated property", () => {
    const DoubleCounter = variable("DoubleCounter", 0);

    const c = create({
      [Counter]: 7,
      [DoubleCounter]() {
        return this[Counter] * 2;
      },
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

  describe("calculated property using call syntax", () => {
    const DoubleCounter = variable("DoubleCounter", 0);

    const c = create(
      compound(
        Counter(7),
        DoubleCounter((self: {}) => self[Counter] * 2)
        // DoubleCounter(function() { return this[Counter] * 2 })
      )
    );
    // const c = declare(compound(Counter(7), DoubleCounter(function() { return this[Counter] * 2 })));
    // const c = declare(compound(Counter(7), DoubleCounter(({ [Counter]: counter }) => counter * 2)));

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
  const Counter = variable("Counter", 0);
  const Pi = variable("Pi", 3.14);

  describe("changing existing property", () => {
    const c1 = create({
      [Counter]: 0,
      [Pi]: 3.14,
    });
    const c2 = fork(c1, { [Counter]: 1 });
    // const c2 = fork(c1, Counter(1));

    it("has reference to parent", () => {
      expect(c2[Parent]).toBe(c1);
    });

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
    const DoubleCounter = variable("DoubleCounter", 0);

    const c1 = create({
      [Counter]: 7,
      [DoubleCounter]() {
        return this[Counter] * 2;
      },
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
    const c1 = create({ [Counter]: 3 });
    const c2 = fork(c1, {
      [Counter]() {
        return this[Parent][Counter] + 1;
      },
    });
    const c3 = fork(
      c2,
      changing(Counter, (n) => n + 1)
    );

    it("adds up", () => {
      expect(c2[Counter]).toEqual(4);
      expect(c3[Counter]).toEqual(5);
    });
  });

  describe("incrementing number with adding()", () => {
    const c1 = create({ [Counter]: 3 });
    // const c1 = declare(Counter(3));
    const c2 = fork(c1, adding(Counter, 1));
    const c3 = fork(c2, {
      [Counter]() {
        return this[Parent][Counter] + 1;
      },
    });
    const c4 = fork(c3, adding(Counter, 1));

    it("adds up", () => {
      expect(c2[Counter]).toEqual(4);
      expect(c3[Counter]).toEqual(5);
      expect(c4[Counter]).toEqual(6);
    });
  });

  describe("appending to array", () => {
    const Todos = variable("Todos", [] as string[]);

    const c1 = create(Todos(["first", "second"]));
    const c2 = fork(c1, appending(Todos, "third"));
    const c3 = fork(c2, appending(Todos, "fourth"));
    const c2B = fork(c1, appending(Todos, "other"));

    it("yields with value appended", () => {
      expect(Array.from(c1[Todos])).toEqual(["first", "second"]);
      expect(Array.from(c2[Todos])).toEqual(["first", "second", "third"]);
      expect(Array.from(c3[Todos])).toEqual([
        "first",
        "second",
        "third",
        "fourth",
      ]);
      expect(Array.from(c2B[Todos])).toEqual(["first", "second", "other"]);
    });
  });

  describe("prepending to array", () => {
    const Todos = variable("Todos", [] as string[]);

    const c1 = Todos(["first", "second"]);
    const c2 = fork(c1, prepending(Todos, "start"));

    it("yields with value prepended", () => {
      expect(Array.from(c2[Todos])).toEqual(["start", "first", "second"]);
    });
  });

  describe("mapping an array", () => {
    const Todos = variable("Todos", [] as string[]);

    const c1 = Todos(["first", "second"]);
    const c2 = fork(
      c1,
      mapping(Todos, (s) => s.toUpperCase())
    );

    it("yields with strings uppercased", () => {
      expect(Array.from(c2[Todos])).toEqual(["FIRST", "SECOND"]);
    });
  });

  describe("struct", () => {
    const Description = variable("Description", "");
    const Completed = variable("Completed", false);
    const Todo = struct("Todo", Description, Completed);

    const c1 = Todo([Description("Write todo list app"), Completed(false)]);

    it("Creates object with multiple fields", () => {
      expect(c1).toEqual({
        [Description]: "Write todo list app",
        [Completed]: false,
      });
    });
  });

  describe("array of structs", () => {
    const Description = variable("Description", "");
    const Completed = variable("Completed", false);
    const Todo = struct("Todo", Description, Completed);
    const Todos = variable("Todos", [] as Array<VariableValue<typeof Todo>>);

    const c1 = Todos([
      Todo([Description("Write todo list app"), Completed(false)]),
    ]);
    const c2 = fork(
      c1,
      appending(
        Todos,
        Todo([Description("Write second item"), Completed(true)])
      )
    );

    it("Creates object with multiple fields", () => {
      expect(c1).toEqual({
        [Todos]: [
          {
            [Description]: "Write todo list app",
            [Completed]: false,
          },
        ],
      });
    });

    it("Appends new todo", () => {
      expect(Array.from(c2[Todos])).toEqual([
        {
          [Description]: "Write todo list app",
          [Completed]: false,
        },
        {
          [Description]: "Write second item",
          [Completed]: true,
        },
      ]);
    });
  });
});

describe("undo/redo with array of structs", () => {
  const Description = variable("Description", "");
  const Completed = variable("Completed", false);
  // const Overdue = variable("Overdue", false);
  const Todo = struct("Todo", Description, Completed);
  const Todos = variable("Todos", [] as Array<VariableValue<typeof Todo>>);

  const history = createHistory(
    Todos([Todo([Description("Write todo list app"), Completed(false)])])
  );

  history.push(
    appending(Todos, Todo([Description("Write second item"), Completed(true)]))
  );

  history.push(
    appending(Todos, Todo([Description("Bake"), Completed(false)]))
  );

  it("allows retrieving the state of the 1st step", () => {
    expect(history.read(0, Todos)).toEqual([
      {
        [Description]: "Write todo list app",
        [Completed]: false,
      },
    ]);
  });

  it("allows retrieving the state of the 2nd step", () => {
    expect(history.read(1, Todos)).toEqual([
      {
        [Description]: "Write todo list app",
        [Completed]: false,
      },
      {
        [Description]: "Write second item",
        [Completed]: true,
      },
    ]);
  });

  it("allows retrieving the state of the 3rd step", () => {
    expect(history.read(2, Todos)).toEqual([
      {
        [Description]: "Write todo list app",
        [Completed]: false,
      },
      {
        [Description]: "Write second item",
        [Completed]: true,
      },
      {
        [Description]: "Bake",
        [Completed]: false,
      },
    ]);
  });

  it.todo("Allows undoing");
  it.todo("Allows redoing");
});

describe("Clocks", () => {
  it("has no state for new clocks and new symbol", () => {
    const clock = makeClock();
    expect(readStateFor(clock.currentCursor)(Symbol())).toBeUndefined();
  });

  it("has reader and write with cursor references", () => {
    const clock = makeClock();

    expect(clock.reader()[Symbol.toPrimitive]()).toBe(clock.currentCursor);
    expect(clock.reader()[cursorSymbol]()).toBe(clock.currentCursor);

    expect(clock.writer()[Symbol.toPrimitive]()).toBe(clock.currentCursor);
    expect(clock.writer()[cursorSymbol]()).toBe(clock.currentCursor);
  });

  it("stores state", () => {
    const clock = makeClock();
    const key = Symbol();
    setStateFor(clock.currentCursor)(key, 7);

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
    setStateFor(clock.currentCursor)(key, 7);
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
    setStateFor(cursorA)(key, 7);
    clock.advance();

    const cursorB = clock.currentCursor;
    setStateFor(cursorB)(key, 9);

    expect(readStateFor(cursorA)(key)).toBe(7);
    expect(readStateFor(clock.currentCursor)(key)).toBe(9);

    expect(reader(key)).toBe(7);
    expect(clock.reader()(key)).toBe(9);
  });

  it("ignores state changes if clock has been advanced", () => {
    const clock = makeClock();
    const key = Symbol();
    const writer = clock.writer();
    writer(key, 7);
    const reader = clock.reader();

    clock.advance();
    writer(key, 8);

    expect(reader(key)).toBe(7);
    expect(clock.reader()(key)).toBe(7);
  });

  it("counts unique readers", () => {
    const clock = makeClock();

    const reader1A = clock.reader();
    const reader1B = clock.reader();

    clock.advance();

    const reader2A = clock.reader();
    const reader2B = clock.reader();

    expect(clock.uniqueCount([])).toBe(0);
    expect(clock.uniqueCount([reader1A])).toBe(1);
    expect(clock.uniqueCount([reader1A, reader1A, reader1A])).toBe(1);
    expect(clock.uniqueCount([reader1A, reader1B])).toBe(1);
    expect(clock.uniqueCount([reader1A, reader1B, reader2A])).toBe(2);
    expect(clock.uniqueCount([reader1A, reader1B, reader2A, reader2B])).toBe(2);
  });
});
