# Network Galaxy Example

A force-directed-style network visualization with 8 connected nodes.

## Data

8 nodes representing a microservices architecture:
- **Database** (central hub)
- **API Server**
- **Cache**
- **Auth Service**
- **Web App**
- **Mobile API**
- **Analytics**
- **Logs**

## Features

- Nodes arranged radially in 3D space
- Size mapped to connection count
- Color mapped to service category
- Hover glow effects
- Connection lines between related nodes
- Click to see node labels

## Running

```bash
npx serve
```

Then navigate to `/network-galaxy/`

## Code Highlights

### Category Color Mapping
```javascript
"color": { "$data": "category", "$map": "category10" }
```

### Connection Lines
Procedurally drawn between nodes based on relationships.

---

*Part of the Nemosyne example gallery*
