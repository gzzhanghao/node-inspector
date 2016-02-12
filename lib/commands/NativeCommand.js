const flatten = require('../util').flatten;

module.exports = function(backend) {

  backend.registerCommands(flatten({

    Console: {
      enable: true,
      setMonitoringXHREnabled: true,
      setTracingBasedTimeline: true
    },

    CSS: {
      disable: true,
      enable: true,
      getSupportedCSSProperties: { cssProperties: [] }
    },

    Debugger: {
      disable: true,
      setAsyncCallStackDepth: true,
      setOverlayMessage: true,
      skipStackFrames: true,
      compileScript: true,
      canSetScriptSource: true
    },

    DOM: {
      disable: true,
      enable: true,
      hideHighlight: true
    },

    DOMDebugger: {
      removeInstrumentationBreakpoint: true,
      removeXHRBreakpoint: true,
      setInstrumentationBreakpoint: true,
      setXHRBreakpoint: true
    },

    HeapProfiler: {
      addInspectedHeapObject: true,
      enable: true
    },

    Network: {
      enable: true,
      setCacheDisabled: true,
      canEmulateNetworkConditions: false,
      setUserAgentOverride: {}
    },

    Page: {
      addScriptToEvaluateOnLoad: true,
      clearDeviceOrientationOverride: true,
      clearGeolocationOverride: true,
      canScreencast: false,
      enable: true,
      reload: true,
      removeScriptToEvaluateOnLoad: true,
      setContinuousPaintingEnabled: true,
      setDeviceMetricsOverride: true,
      setDeviceOrientationOverride: true,
      setEmulatedMedia: true,
      setForceCompositingMode: true,
      setGeolocationOverride: true,
      setOverlayMessage: true,
      setScriptExecutionDisabled: true,
      setShowDebugBorders: true,
      setShowFPSCounter: true,
      setShowPaintRects: true,
      setShowScrollBottleneckRects: true,
      setShowViewportSizeOnResize: true,
      setTouchEmulationEnabled: true,
      getScriptExecutionStatus: 'enabled'
    },

    Profiler: {
      enable: true,
      setSamplingInterval: true
    },

    Worker: {
      enable: true,
      canInspectWorkers: false,
      setAutoconnectToWorkers: true
    },

    IndexedDB: {
      enable: true,
      requestDatabaseNames: { databaseNames: [] }
    },

    'Database.enable': true,
    'DOMStorage.enable': true,
    'Inspector.enable': true,
    'Runtime.run': true,
    'Emulation.canEmulate': false
  }));
};
