var shell = require('shelljs');

function noop() {}

function FlowStatusWebpackPlugin(options) {
  this.options = options || {};
}

FlowStatusWebpackPlugin.prototype.apply = function(compiler) {
  var options = this.options;
  var flowArgs = options.flowArgs || '';
  var flow = options.binaryPath || 'flow';
  var failOnError = options.failOnError || false;
  var onSuccess = options.onSuccess || noop;
  var onError = options.onError || noop;
  var firstRun = true;
  var waitingForFlow = false;

  function startFlow(cb) {
    if (options.restartFlow === false) {
      cb();
    } else {
      shell.exec(flow + ' stop', {silent: true}, function() {
        shell.exec(flow + ' start ' + flowArgs, {silent: true}, cb);
      });
    }
  }

  function startFlowIfFirstRun(cb) {
    if (firstRun) {
      firstRun = false;
      startFlow(cb);
    } else {
      cb();
    }
  }

  function flowStatus(successCb, errorCb) {
    if (!waitingForFlow) {
      waitingForFlow = true;

      // this will start a flow server if it was not running
      shell.exec(flow + ' status --color always', {silent: true}, function(code, stdout, stderr) {
        var hasErrors = code !== 0;
        var cb = hasErrors ? errorCb : successCb;
        waitingForFlow = false;

        cb(stdout, stderr);
      });
    }
  }

  var flowError = null;

  function checkItWreckIt(cb) {
    startFlowIfFirstRun(function () {
      flowStatus(function success(stdout) {
        onSuccess(stdout);
        cb();
      }, function error(stdout) {
        onError(stdout);

        flowError = new Error(stdout);
        // Do not pass error to callback to avoid dev server exit
        cb();
      });
    });
  }

  // Webpack 5 hooks
  compiler.hooks.run.tapAsync('FlowStatusWebpackPlugin', (compilation, callback) => {
    checkItWreckIt(callback);
  });

  compiler.hooks.watchRun.tapAsync('FlowStatusWebpackPlugin', (compilation, callback) => {
    checkItWreckIt(callback);
  });

  // Add errors to compilation if needed
  compiler.hooks.compilation.tap('FlowStatusWebpackPlugin', (compilation) => {
    if (flowError) {
      if (failOnError === true) {
        compilation.errors.push(flowError);
      }
      flowError = null;
    }
  });
};

module.exports = FlowStatusWebpackPlugin;
