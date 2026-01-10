# Code with Special Characters

```javascript
const operators = '<>&"\\''';
const template = `Hello ${name}`;
const regex = /^[a-z]+$/gi;
const html = '<div class="test">Content</div>';
```

```html
<!DOCTYPE html>
<html>
  <head>
    <title>&lt;Special&gt;</title>
  </head>
  <body>
    <p>&amp; &copy; &reg;</p>
  </body>
</html>
```
