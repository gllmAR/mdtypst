# Python Example

```python
# A class example
class Person:
    """A simple Person class"""
    
    def __init__(self, name: str, age: int):
        self.name = name
        self.age = age
    
    def greet(self) -> str:
        return f"Hello, I'm {self.name} and I'm {self.age} years old"

# Create an instance
person = Person("Alice", 30)
print(person.greet())
```
