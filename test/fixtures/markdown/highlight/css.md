# CSS Example

```css
/* Modern CSS example */
:root {
    --primary-color: #3498db;
    --font-size: 16px;
}

.container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 20px;
}

.button {
    background-color: var(--primary-color);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    transition: opacity 0.3s ease;
}

.button:hover {
    opacity: 0.8;
}

@media (max-width: 768px) {
    .container {
        padding: 10px;
    }
}
```
