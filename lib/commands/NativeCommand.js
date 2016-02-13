const flatten = require('../util').flatten;

module.exports = function(backend) {

  backend.registerCommands(flatten({

    Console: {
      enable: false,
      setMonitoringXHREnabled: false,
      setTracingBasedTimeline: false
    },

    CSS: {
      disable: false,
      enable: false,
      getSupportedCSSProperties: { cssProperties: [] }
    },

    Debugger: {
      disable: false,
      setAsyncCallStackDepth: false,
      setOverlayMessage: false,
      skipStackFrames: false,
      compileScript: false,
      canSetScriptSource: false
    },

    DOM: {
      disable: false,
      enable: false,
      hideHighlight: false
    },

    DOMDebugger: {
      removeInstrumentationBreakpoint: false,
      removeXHRBreakpoint: false,
      setInstrumentationBreakpoint: false,
      setXHRBreakpoint: false
    },

    HeapProfiler: {
      addInspectedHeapObject: false,
      enable: false
    },

    Network: {
      enable: false,
      setCacheDisabled: false,
      canEmulateNetworkConditions: false,
      setUserAgentOverride: {}
    },

    Page: {
      addScriptToEvaluateOnLoad: false,
      clearDeviceOrientationOverride: false,
      clearGeolocationOverride: false,
      canScreencast: false,
      enable: false,
      reload: false,
      removeScriptToEvaluateOnLoad: false,
      setContinuousPaintingEnabled: false,
      setDeviceMetricsOverride: false,
      setDeviceOrientationOverride: false,
      setEmulatedMedia: false,
      setForceCompositingMode: false,
      setGeolocationOverride: false,
      setOverlayMessage: false,
      setScriptExecutionDisabled: false,
      setShowDebugBorders: false,
      setShowFPSCounter: false,
      setShowPaintRects: false,
      setShowScrollBottleneckRects: false,
      setShowViewportSizeOnResize: false,
      setTouchEmulationEnabled: false,
      getScriptExecutionStatus: 'enabled'
    },

    Profiler: {
      enable: false,
      setSamplingInterval: false
    },

    Worker: {
      enable: false,
      canInspectWorkers: false,
      setAutoconnectToWorkers: false
    },

    IndexedDB: {
      enable: false,
      requestDatabaseNames: { databaseNames: [] }
    },

    'Database.enable': false,
    'DOMStorage.enable': false,
    'Inspector.enable': false,
    'Runtime.run': false,
    'Emulation.canEmulate': false
  }));
};
