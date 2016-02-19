var origin = WebInspector.Target.prototype._loadedWithCapabilities;
WebInspector.Target.prototype._loadedWithCapabilities = function(callback)
{
  if (this._connection.isClosed()) {
    callback(null);
    return;
  }
  /** @type {!WebInspector.NodeInspectorModel} */
  this.nodeInspectorModel = new WebInspector.NodeInspectorModel(this);
  origin.call(this, callback);
}
