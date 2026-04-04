# Curiosity Report: Mutation Testing with Stryker

## Why I Chose This

When working with tests, I usually just check if they pass and look at code coverage. That always felt like enough, but I kept hearing that high coverage does not actually mean your tests are good. That made me curious about what I might be missing. Mutation testing stood out because it claims to actually test the quality of your tests, not just whether they run.

## What I Thought Before

Before this, I assumed that if my tests passed and I had decent coverage, then my code was solid. I thought bugs would get caught as long as I wrote enough tests. I did not really think about whether my tests were actually strong or just happening to pass.

## Research

Mutation testing works by intentionally changing small parts of your code, called mutations, to see if your tests catch the change. If the tests fail, that mutation is considered killed. If the tests still pass, that mutation survived, which means your tests did not catch a problem.

Stryker is a tool that automates this process. It goes through your code and makes small changes like:
- changing a plus to a minus
- flipping a boolean
- removing a condition

Then it runs your test suite against each mutated version of the code.

The key idea is that good tests should fail when the code is wrong. If they do not, then the tests are weak even if they pass normally.

## Experimentation

I created a simple function and wrote tests for it using Jest.

Function:

```javascript
function add(a, b) {
  return a + b;
}

module.exports = add;
```

Test:

```javascript
const add = require('./add');

test('adds two numbers', () => {
  expect(add(2, 3)).toBe(5);
});
```

At this point, everything passed and coverage was 100 percent.

Then I installed Stryker and ran mutation testing.

What Stryker did:
- It changed the function to return a minus instead of a plus
- It also tried returning just one of the inputs

Results:
- Some mutations were caught by the test
- Some mutations survived

For example, when the function returned just a, the test still passed for the specific case I wrote. That means my test was not strong enough.

## What I Learned

The biggest thing I learned is that passing tests do not mean good tests. My test only checked one case, so it missed obvious issues.

Mutation testing exposed weaknesses that I would not have noticed otherwise. It forced me to think about edge cases and different inputs instead of just writing one simple test.

I also learned that code coverage can be misleading. Even with 100 percent coverage, my tests were still not very good.

## Practical Applications

This changes how I think about testing. Instead of just writing enough tests to pass, I should:
- test multiple cases
- include edge cases
- think about what could go wrong

Mutation testing is useful because it gives a more honest measure of test quality. I would not run it all the time since it is slower, but it seems really useful before finalizing important code.

## Sources

https://stryker-mutator.io/docs/
https://en.wikipedia.org/wiki/Mutation_testing
https://jestjs.io/docs/getting-started
