# Virtual Worlds / Gaming Example

Game engine data visualization and world building.

## Use Case
Level editor, NPC spawn visualization, performance profiling.

## Data Schema
```json
{
  "level": {
    "name": "Dungeon Level 1",
    "dimensions": { "x": 100, "y": 20, "z": 100 }
  },
  "objects": [
    {
      "id": "enemy-spawn-001",
      "type": "spawn-point",
      "position": [25, 0, 40],
      "npcType": "goblin",
      "respawnTime": 300
    },
    {
      "id": "chest-001",      "type": "loot-container",
      "position": [50, 0, 50],      "lootTable": "treasure-tier-2"
    }
  ],
  "navmesh": {
    "vertices": [[0,0,0], [10,0,0], [10,0,10]],
    "triangles": [[0, 1, 2]]
  },
  "triggers": [
    {      "id": "boss-arena",
      "bounds": [[40, 0, 40], [60, 10, 60]],
      "event": "spawn-boss"
    }
  ]
}
```

## Artefacts
- **Spawn Points:** Pulsing orbs showing spawn activity
- **NPC Paths:** Trails showing patrol routes
- **Trigger Zones:** Wireframe boxes for script triggers
- **Performance Heatmap:** FPS/sensor overlay on geometry
- **Loot Tables:** Floating card visualizations

## Behaviours
- Click to edit entity properties
- Drag to reposition
- Test mode: trigger spawn, follow NPC
- Profiler overlay: draw calls, triangles

## Extensions Required
- BSP navmesh rendering
- Real-time profiling overlay
- Entity property editor
- Path creation tools
