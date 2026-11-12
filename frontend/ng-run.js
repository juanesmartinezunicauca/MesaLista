process.env.NG_FORCE_NODE = '1';
try {
  const nodeUtils = require('@angular/cli/src/utilities/node-version');
  if (nodeUtils) {
    nodeUtils.isNodeVersionSupported = () => true;
  }
} catch (_) {}
require('@angular/cli/bin/bootstrap');
