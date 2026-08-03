# Industrial IoT Example

Real-time sensor monitoring using the `sensor-stream` sample dataset and the built-in demo WebSocket stream.

## What it shows

`src/data/SampleDatasets.js` defines an IoT sensor time-series with hourly temperature and vibration readings for two sensors:

| time | sensorId | temperature | vibration |
|---|---|---|---|
| 2026-07-28T00:00:00 | S1 | 22.1 | 0.04 |
| 2026-07-28T01:00:00 | S1 | 22.4 | 0.05 |
| ... | ... | ... | ... |

The Draco engine sees the `time` and numeric columns, infers **TIME_SERIES**, and lays the data out as a time ribbon with token markers.

## Artefacts generated

- **Time ribbon** — continuous trail of temperature/vibration over time.
- **Token markers** — one per row, sized by vibration.
- **Colour encoding** — temperature maps to a warm/cool scale.
- **Anomaly halos** — pulsing magenta rings when an outlier is detected.

## Try this in VR

1. Launch the app and open the wheel menu.
2. Choose **Views → Dataset** and pick **IoT Sensor Stream**.
3. Connect the live stream:
   - **Wheel menu → Live → Demo Stream** connects to the dev-server endpoint `wss://host/__demo-stream`.
   - New rows arrive once per second and extend the ribbon.
4. Operations you can perform:
   - **Time slice** — wheel menu or `sliceDown` gesture.
   - **Anomaly on `vibration`** — wheel menu **Ops → Highlight Outliers**.
   - **Sort by temperature** — `sliceUp` gesture.
   - **Reset** — `pushForward` gesture.

## Bring your own stream

For local development the Vite server already hosts `/__demo-stream`. In production, point `WebSocketAdapter` at your own secure WebSocket endpoint and supply a `parseMessage` or `binaryParser` callback to convert your payload into `{ rows, topology?, name? }` rows. The runtime ships with a JSON parser; bring your own parser for MessagePack, Apache Arrow, or FlatBuffers frames.

## Export

Use **Panels → Export Story** to save the buffered dataset and operation history.
