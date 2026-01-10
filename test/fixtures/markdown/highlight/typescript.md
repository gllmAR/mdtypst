# TypeScript Example

```typescript
interface User {
  id: number;
  name: string;
  email?: string;
}

type UserList = User[];

async function fetchUsers(): Promise<UserList> {
  const response = await fetch('/api/users');
  return response.json();
}

const users: UserList = await fetchUsers();
```
