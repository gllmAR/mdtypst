# JavaScript Example

```javascript
// A simple function
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

const result = fibonacci(10);
console.log(`Fib(10) = ${result}`);
```
