WebInspector.NodeInspectorModel = function(target)
{
  WebInspector.SDKModel.call(this, WebInspector.NodeInspectorModel, target);
  target.registerNodeInspectorDispatcher(new WebInspector.NodeInspectorDispatcher(this));

  this._nodeInspectorAgent = target.nodeInspectorAgent();
  this._nodeInspectorEnabled = false;

  this.enableNodeInspector();
}

WebInspector.NodeInspectorModel.Events = {
  InspectorWillRestart: 'InspectorWillRestart'
};

WebInspector.NodeInspectorModel.prototype = {

  nodeInspectorEnabled: function()
  {
    return this._nodeInspectorEnabled;
  },

  enableNodeInspector: function()
  {
    function callback()
    {
      this._nodeInspectorEnabled = true;
    }
    this._nodeInspectorAgent.enable(callback.bind(this));
  },

  _restartInspector: function()
  {
    this.dispatchEventToListeners(WebInspector.NodeInspectorModel.Events.InspectorWillRestart);
    WebInspector.reload();
  },

  __proto__: WebInspector.SDKModel.prototype
}

WebInspector.NodeInspectorDispatcher = function(nodeInspector)
{
  this._nodeInspector = nodeInspector;
}

WebInspector.NodeInspectorDispatcher.prototype = {

  restart: function(payload)
  {
    this._nodeInspector._restartInspector();
  }
};
