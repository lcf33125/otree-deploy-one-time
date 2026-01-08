# Python Proxy Configuration Fix

## Problem

When installing Python packages via pip in environments with proxy settings configured (either in environment variables or system settings), pip may fail with proxy connection errors like:

```
ProxyError('Cannot connect to proxy.', OSError(0, 'Error'))
ERROR: Could not find a version that satisfies the requirement otree<5,>2.4
```

## Root Cause

The application spawns pip processes that inherit proxy-related environment variables from the parent process. When these proxies are misconfigured or unavailable, pip cannot connect to PyPI to download packages.

## Solution

The fix disables proxy usage for all pip operations by:

1. **Adding `--no-proxy` flag to all pip commands**: This tells pip to bypass proxy settings
2. **Removing proxy environment variables**: Deletes all proxy-related environment variables before spawning pip processes

### Environment Variables Removed

- `HTTP_PROXY` / `http_proxy`
- `HTTPS_PROXY` / `https_proxy`
- `ALL_PROXY` / `all_proxy`
- `NO_PROXY` / `no_proxy`

## Affected Functions

The following operations now bypass proxy settings:

1. **Virtual environment setup** ([otree-controller.ts:330](src/main/otree-controller.ts#L330))
   - Installing virtualenv for embeddable Python distributions

2. **Requirements installation** ([otree-controller.ts:423](src/main/otree-controller.ts#L423))
   - Installing from `requirements.txt`
   - Installing oTree when no requirements file exists

3. **Project creation** ([otree-controller.ts:979](src/main/otree-controller.ts#L979))
   - Installing oTree before creating a new project

4. **Python repair** ([otree-controller.ts:833](src/main/otree-controller.ts#L833))
   - Reinstalling virtualenv for managed Python versions

## Implementation Details

### Before
```typescript
const installProcess = spawn(pipExe, ['install', 'otree'], {
  cwd: pythonDir
})
```

### After
```typescript
// Prepare environment without proxy settings
const pipEnv = { ...process.env }
delete pipEnv.HTTP_PROXY
delete pipEnv.HTTPS_PROXY
delete pipEnv.http_proxy
delete pipEnv.https_proxy
delete pipEnv.ALL_PROXY
delete pipEnv.all_proxy
delete pipEnv.NO_PROXY
delete pipEnv.no_proxy

const installProcess = spawn(pipExe, ['install', '--no-proxy', 'otree'], {
  cwd: pythonDir,
  env: pipEnv
})
```

## Alternative Solutions (Not Implemented)

If direct internet access is not available and a working proxy is required:

1. **Configure pip proxy settings**: Users can manually configure pip to use their proxy:
   ```bash
   pip config set global.proxy http://proxy.example.com:8080
   ```

2. **Use custom PyPI mirror**: Organizations can set up an internal PyPI mirror and configure pip to use it:
   ```bash
   pip config set global.index-url https://pypi.internal.example.com/simple
   ```

3. **Pre-download packages**: For air-gapped environments, packages can be downloaded separately and installed from local files.

## Testing

To verify the fix works:

1. Set proxy environment variables to invalid values:
   ```bash
   set HTTP_PROXY=http://invalid-proxy:8080
   set HTTPS_PROXY=http://invalid-proxy:8080
   ```

2. Try to install requirements in the oTree Launcher
3. Installation should succeed, bypassing the invalid proxy

## Security Considerations

- This fix maintains the existing security model (no `shell: true` in spawn calls)
- Direct internet access is required for pip to download packages
- Users behind corporate firewalls may need to whitelist PyPI domains:
  - `pypi.org`
  - `files.pythonhosted.org`

## Related Files

- [src/main/otree-controller.ts](src/main/otree-controller.ts) - Main implementation
- [src/main/python-manager.ts](src/main/python-manager.ts) - Python version management
- [CLAUDE.md](CLAUDE.md) - Project documentation
