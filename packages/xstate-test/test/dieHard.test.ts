import { assign, createMachine } from 'xstate';
import { createTestModel } from '../src';
import { coversAllStates } from '../src/coverage';
import { createTestMachine } from '../src/machine';
import { getDescription } from '../src/utils';

describe('die hard example', () => {
  interface DieHardContext {
    three: number;
    five: number;
  }

  const pour3to5 = assign<DieHardContext>((ctx) => {
    const poured = Math.min(5 - ctx.five, ctx.three);

    return {
      three: ctx.three - poured,
      five: ctx.five + poured
    };
  });
  const pour5to3 = assign<DieHardContext>((ctx) => {
    const poured = Math.min(3 - ctx.three, ctx.five);

    const res = {
      three: ctx.three + poured,
      five: ctx.five - poured
    };

    return res;
  });
  const fill3 = assign<DieHardContext>({ three: 3 });
  const fill5 = assign<DieHardContext>({ five: 5 });
  const empty3 = assign<DieHardContext>({ three: 0 });
  const empty5 = assign<DieHardContext>({ five: 0 });

  class Jugs {
    public version = 0;
    public three = 0;
    public five = 0;

    public fillThree() {
      this.three = 3;
    }
    public fillFive() {
      this.five = 5;
    }
    public emptyThree() {
      this.three = 0;
    }
    public emptyFive() {
      this.five = 0;
    }
    public transferThree() {
      const poured = Math.min(5 - this.five, this.three);

      this.three = this.three - poured;
      this.five = this.five + poured;
    }
    public transferFive() {
      const poured = Math.min(3 - this.three, this.five);

      this.three = this.three + poured;
      this.five = this.five - poured;
    }
  }
  let jugs: Jugs;

  const createDieHardModel = () => {
    const dieHardMachine = createMachine<DieHardContext>(
      {
        id: 'dieHard',
        initial: 'pending',
        context: { three: 0, five: 0 },
        states: {
          pending: {
            always: {
              target: 'success',
              cond: 'weHave4Gallons'
            },
            on: {
              POUR_3_TO_5: {
                actions: pour3to5
              },
              POUR_5_TO_3: {
                actions: pour5to3
              },
              FILL_3: {
                actions: fill3
              },
              FILL_5: {
                actions: fill5
              },
              EMPTY_3: {
                actions: empty3
              },
              EMPTY_5: {
                actions: empty5
              }
            }
          },
          success: {
            type: 'final'
          }
        }
      },
      {
        guards: {
          weHave4Gallons: (ctx) => ctx.five === 4
        }
      }
    );

    return createTestModel(dieHardMachine, {
      states: {
        pending: (state) => {
          expect(jugs.five).not.toEqual(4);
          expect(jugs.three).toEqual(state.context.three);
          expect(jugs.five).toEqual(state.context.five);
        },
        success: () => {
          expect(jugs.five).toEqual(4);
        }
      },
      events: {
        POUR_3_TO_5: {
          exec: async () => {
            await jugs.transferThree();
          }
        },
        POUR_5_TO_3: {
          exec: async () => {
            await jugs.transferFive();
          }
        },
        EMPTY_3: {
          exec: async () => {
            await jugs.emptyThree();
          }
        },
        EMPTY_5: {
          exec: async () => {
            await jugs.emptyFive();
          }
        },
        FILL_3: {
          exec: async () => {
            await jugs.fillThree();
          }
        },
        FILL_5: {
          exec: async () => {
            await jugs.fillFive();
          }
        }
      }
    });
  };

  beforeEach(() => {
    jugs = new Jugs();
    jugs.version = Math.random();
  });

  describe('testing a model (shortestPathsTo)', () => {
    const dieHardModel = createDieHardModel();

    dieHardModel
      .getShortestPlansTo((state) => state.matches('success'))
      .forEach((plan) => {
        describe(`plan ${getDescription(plan.state)}`, () => {
          it('should generate a single path', () => {
            expect(plan.paths.length).toEqual(1);
          });

          plan.paths.forEach((path) => {
            it(`path ${getDescription(path.state)}`, async () => {
              await dieHardModel.testPath(path);
            });
          });
        });
      });
  });

  describe('testing a model (simplePathsTo)', () => {
    const dieHardModel = createDieHardModel();
    dieHardModel
      .getSimplePlansTo((state) => state.matches('success'))
      .forEach((plan) => {
        describe(`reaches state ${JSON.stringify(
          plan.state.value
        )} (${JSON.stringify(plan.state.context)})`, () => {
          plan.paths.forEach((path) => {
            it(`path ${getDescription(path.state)}`, async () => {
              await dieHardModel.testPath(path);
            });
          });
        });
      });
  });

  describe('testing a model (getPlanFromEvents)', () => {
    const dieHardModel = createDieHardModel();

    const plan = dieHardModel.getPlanFromEvents(
      [
        { type: 'FILL_5' },
        { type: 'POUR_5_TO_3' },
        { type: 'EMPTY_3' },
        { type: 'POUR_5_TO_3' },
        { type: 'FILL_5' },
        { type: 'POUR_5_TO_3' }
      ],
      (state) => state.matches('success')
    );

    describe(`reaches state ${JSON.stringify(
      plan.state.value
    )} (${JSON.stringify(plan.state.context)})`, () => {
      plan.paths.forEach((path) => {
        it(`path ${getDescription(path.state)}`, async () => {
          await dieHardModel.testPath(path);
        });
      });
    });

    it('should throw if the target does not match the last entered state', () => {
      expect(() => {
        dieHardModel.getPlanFromEvents([{ type: 'FILL_5' }], (state) =>
          state.matches('success')
        );
      }).toThrow();
    });
  });

  describe('.testPath(path)', () => {
    const dieHardModel = createDieHardModel();
    const plans = dieHardModel.getSimplePlansTo((state) => {
      return state.matches('success') && state.context.three === 0;
    });

    plans.forEach((plan) => {
      describe(`reaches state ${JSON.stringify(
        plan.state.value
      )} (${JSON.stringify(plan.state.context)})`, () => {
        plan.paths.forEach((path) => {
          describe(`path ${getDescription(path.state)}`, () => {
            it(`reaches the target state`, async () => {
              await dieHardModel.testPath(path);
            });
          });
        });
      });
    });
  });

  it('reports state node coverage', async () => {
    const dieHardModel = createDieHardModel();
    const plans = dieHardModel.getSimplePlansTo((state) => {
      return state.matches('success') && state.context.three === 0;
    });

    for (const plan of plans) {
      for (const path of plan.paths) {
        jugs = new Jugs();
        jugs.version = Math.random();
        await dieHardModel.testPath(path);
      }
    }

    const coverage = dieHardModel.getCoverage(coversAllStates());

    expect(coverage.every((c) => c.status === 'covered')).toEqual(true);

    expect(coverage.map((c) => [c.criterion.description, c.status]))
      .toMatchInlineSnapshot(`
      Array [
        Array [
          "Visits \\"dieHard\\"",
          "covered",
        ],
        Array [
          "Visits \\"dieHard.pending\\"",
          "covered",
        ],
        Array [
          "Visits \\"dieHard.success\\"",
          "covered",
        ],
      ]
    `);

    expect(() => dieHardModel.testCoverage(coversAllStates())).not.toThrow();
  });
});
describe('error path trace', () => {
  describe('should return trace for failed state', () => {
    const machine = createTestMachine({
      initial: 'first',
      states: {
        first: {
          on: { NEXT: 'second' }
        },
        second: {
          on: { NEXT: 'third' }
        },
        third: {}
      }
    });

    const testModel = createTestModel(machine, {
      states: {
        third: () => {
          throw new Error('test error');
        }
      }
    });

    testModel
      .getShortestPlansTo((state) => state.matches('third'))
      .forEach((plan) => {
        plan.paths.forEach((path) => {
          it('should show an error path trace', async () => {
            try {
              await testModel.testPath(path, undefined);
            } catch (err) {
              expect(err.message).toEqual(
                expect.stringContaining('test error')
              );
              expect(err.message).toMatchInlineSnapshot(`
                "test error
                Path:
                	State: {\\"value\\":\\"first\\",\\"actions\\":[]}
                	Event: {\\"type\\":\\"NEXT\\"}

                	State: {\\"value\\":\\"second\\",\\"actions\\":[]}
                	Event: {\\"type\\":\\"NEXT\\"}

                	State: {\\"value\\":\\"third\\",\\"actions\\":[]}"
              `);
              return;
            }

            throw new Error('Should have failed');
          });
        });
      });
  });
});
