# Contributing to SRNE Solar Station Monitor for Linux

Thank you for contributing! Hardware telemetry tools improve fastest when real-world inverter logs, register maps, and Linux/ESP board quirks are shared.

## Development Workflow

1. Fork the repository and create a feature branch from `main`.
2. Install dependencies and run the development server:
   ```bash
   npm install
   npm run dev
   ```
3. Before opening a pull request, verify TypeScript types and the production build:
   ```bash
   npm run lint
   npm run build
   ```

## Adding Support for New SRNE Models or OEM Rebrands

When submitting register maps or fault codes for a new model (e.g., HF4850U80-H, ASP48100U200-H, ML2440, etc.):

- Include the exact model number and firmware version if known.
- Provide captured TX/RX hex frames from the **Modbus Packets** console (with CRC-16 verified).
- Update `src/utils/modbus.ts` and keep register scaling units documented.

## Firmware Contributions (`firmware/esp32` & `firmware/esp8266`)

- Never commit personal Wi-Fi SSIDs or passwords. Use placeholder strings (`YOUR_WIFI_SSID`, `YOUR_WIFI_PASSWORD`).
- Keep `src/utils/espFirmwareGenerator.ts` in sync with standalone firmware files under `firmware/`.
- Test watchdog recovery and LittleFS offline buffering across at least one disconnect/reconnect cycle before submitting changes.

## Pull Request Checklist

- [ ] `npm run lint` passes with zero errors
- [ ] `npm run build` completes cleanly
- [ ] No real credentials, `.env` secrets, or local build artifacts included
- [ ] README updated if new configuration options or hardware pins were introduced
