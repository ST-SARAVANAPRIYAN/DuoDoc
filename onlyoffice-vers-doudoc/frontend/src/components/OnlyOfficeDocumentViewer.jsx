import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { fetchOnlyOfficeConfig } from '../api/onlyofficeApi';

const ONESCRIPT_PLUGIN_GUID = 'asc.{9FDA57E0-71DF-4658-92DB-30387D3DAC70}';

const OnlyOfficeDocumentViewer = forwardRef(function OnlyOfficeDocumentViewer(
  { documentId, onSelectionChange, onPluginReady, className = '' },
  ref
) {
  const containerRef = useRef(null);
  const docEditorRef = useRef(null);
  const pluginWindowRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pluginConnected, setPluginConnected] = useState(false);

  // Listen for handshake and messages from the OneScript Bridge Plugin
  useEffect(() => {
    const handleWindowMessage = (event) => {
      const msg = event.data;
      if (!msg) return;

      let parsed = msg;
      if (typeof msg === 'string') {
        try { parsed = JSON.parse(msg); } catch (e) {}
      }

      if (parsed.type === 'ONESCRIPT_PLUGIN_READY') {
        console.log('[OnlyOffice Viewer] OneScript Bridge Plugin connected! Capturing plugin window:', event.source);
        if (event.source) {
          pluginWindowRef.current = event.source;
        }
        setPluginConnected(true);
        onPluginReady?.();
      } else if (parsed.type === 'ONESCRIPT_SELECTION_CHANGED') {
        onSelectionChange?.(parsed.data);
      } else if (parsed.type === 'ONESCRIPT_ACTION_COMPLETED') {
        console.log('[OnlyOffice Viewer] Action executed inside ONLYOFFICE canvas:', parsed.result);
      }
    };

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, [onSelectionChange, onPluginReady]);

  // Periodic handshake ping to ensure plugin connects as soon as editor finishes loading
  useEffect(() => {
    if (pluginConnected) return;

    const ping = () => {
      try {
        const iframe = containerRef.current?.querySelector('iframe');
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'ONESCRIPT_PING' }, '*');
          iframe.contentWindow.postMessage(JSON.stringify({ type: 'ONESCRIPT_PING' }), '*');
          try {
            const innerFrames = iframe.contentDocument?.querySelectorAll('iframe') || [];
            innerFrames.forEach((inner) => {
              inner.contentWindow?.postMessage({ type: 'ONESCRIPT_PING' }, '*');
            });
          } catch (e) {}
        }
      } catch (e) {}
    };

    ping();
    const pingTimer = setInterval(ping, 600);
    return () => clearInterval(pingTimer);
  }, [pluginConnected]);

  // Send command to OneScript Bridge Plugin via postMessage
  const executePluginAction = (actionPayload) => {
    try {
      console.log('[OnlyOffice Viewer] Executing plugin action:', actionPayload);

      const payloadObj = {
        type: 'onExternalPluginMessage',
        pluginGuid: ONESCRIPT_PLUGIN_GUID,
        data: actionPayload,
      };
      const payloadStr = JSON.stringify(payloadObj);

      const customObj = {
        type: 'ONESCRIPT_EXECUTE_ACTION',
        data: actionPayload,
      };
      const customStr = JSON.stringify(customObj);

      let dispatched = false;

      // Strategy 1: Direct postMessage to the plugin frame window (captured during handshake)
      if (pluginWindowRef.current) {
        try {
          pluginWindowRef.current.postMessage(customObj, '*');
          pluginWindowRef.current.postMessage(customStr, '*');
          pluginWindowRef.current.postMessage(payloadObj, '*');
          pluginWindowRef.current.postMessage(payloadStr, '*');
          dispatched = true;
        } catch (e) {
          console.warn('[OnlyOffice Viewer] Direct plugin window dispatch error:', e);
        }
      }

      // Strategy 2: Broadcast to editor iframe and nested frames
      const iframe = containerRef.current?.querySelector('iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(payloadObj, '*');
        iframe.contentWindow.postMessage(payloadStr, '*');
        iframe.contentWindow.postMessage(customObj, '*');
        iframe.contentWindow.postMessage(customStr, '*');

        // Strategy 3: Broadcast to any accessible nested frames inside the editor
        try {
          const innerFrames = iframe.contentDocument?.querySelectorAll('iframe') || [];
          innerFrames.forEach((inner) => {
            try {
              inner.contentWindow?.postMessage(customObj, '*');
              inner.contentWindow?.postMessage(customStr, '*');
              inner.contentWindow?.postMessage(payloadObj, '*');
              inner.contentWindow?.postMessage(payloadStr, '*');
            } catch (ie) {}
          });
        } catch (ce) {
          // Cross-origin boundary is normal
        }
        dispatched = true;
      }

      return dispatched;
    } catch (err) {
      console.error('[OnlyOffice Viewer] Error sending action to plugin:', err);
      return false;
    }
  };

  // Load ONLYOFFICE DocsAPI Script and Initialize Editor
  const initEditor = React.useCallback(async () => {
    if (!documentId) return;

    setLoading(true);
    setError(null);
    setPluginConnected(false);

    // Destroy existing instance if present
    if (docEditorRef.current) {
      try {
        docEditorRef.current.destroyEditor();
      } catch (e) {
        console.warn('Destroy editor cleanup error:', e);
      }
      docEditorRef.current = null;
    }

    let safetyTimer = null;
    try {
      const configData = await fetchOnlyOfficeConfig(documentId);

      const { config, doc_server_api_url } = configData;

      // Ensure DocsAPI script is loaded
      if (!window.DocsAPI) {
        await new Promise((resolve, reject) => {
          if (window.DocsAPI) return resolve();
          const existingScript = document.getElementById('onlyoffice-api-script');
          if (existingScript) {
            existingScript.addEventListener('load', () => resolve());
            existingScript.addEventListener('error', () => reject(new Error('Failed to load DocsAPI script')));
            const checkInterval = setInterval(() => {
              if (window.DocsAPI) {
                clearInterval(checkInterval);
                resolve();
              }
            }, 100);
            setTimeout(() => {
              clearInterval(checkInterval);
              if (window.DocsAPI) resolve();
              else reject(new Error('Timeout loading ONLYOFFICE DocsAPI script'));
            }, 6000);
            return;
          }
          const script = document.createElement('script');
          script.id = 'onlyoffice-api-script';
          script.src = doc_server_api_url;
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load ONLYOFFICE Document Server API script. Ensure container is running on port 9000.'));
          document.body.appendChild(script);
        });
      }

      // Create target mount element with string ID
      const targetElementId = `onlyoffice-canvas-target-${documentId}`;
      if (containerRef.current) {
        containerRef.current.innerHTML = `<div id="${targetElementId}" style="width: 100%; height: 100%;"></div>`;
      }

      // Safety fallback timer to prevent permanent loading lock
      safetyTimer = setTimeout(() => {
        setLoading(false);
      }, 8000);

      // Instantiate ONLYOFFICE DocEditor passing the string placeholder ID
      const editor = new window.DocsAPI.DocEditor(targetElementId, {
        ...config,
        width: '100%',
        height: '100%',
        events: {
          onAppReady: () => {
            console.log('[ONLYOFFICE] onAppReady');
            if (safetyTimer) clearTimeout(safetyTimer);
            setLoading(false);
          },
          onDocumentReady: () => {
            console.log('[ONLYOFFICE] onDocumentReady');
            if (safetyTimer) clearTimeout(safetyTimer);
            setLoading(false);
          },
          onError: (err) => {
            console.error('[ONLYOFFICE Error]', err);
            if (safetyTimer) clearTimeout(safetyTimer);
            setError(err?.data?.errorDescription || 'Document loading error');
            setLoading(false);
          },
        },
      });

      docEditorRef.current = editor;
    } catch (err) {
      if (safetyTimer) clearTimeout(safetyTimer);
      setError(err.message);
      setLoading(false);
    }
  }, [documentId]);

  // Expose executePluginAction and reload to parent component via ref
  useImperativeHandle(ref, () => ({
    executePluginAction,
    isReady: () => pluginConnected,
    reload: initEditor,
  }));

  useEffect(() => {
    initEditor();

    return () => {
      if (docEditorRef.current) {
        try {
          docEditorRef.current.destroyEditor();
        } catch (e) {}
        docEditorRef.current = null;
      }
    };
  }, [initEditor]);

  return (
    <div className={`relative w-full h-full flex flex-col bg-[#1E293B] ${className}`} style={{ minHeight: '600px', height: '100%' }}>
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0F172A]/80 backdrop-blur-sm text-white">
          <Loader2 className="w-8 h-8 animate-spin text-[#38BDF8] mb-3" />
          <p className="text-sm font-medium">Initializing ONLYOFFICE Native Canvas...</p>
          <p className="text-xs text-slate-400 mt-1">Connecting OneScript Bridge & Document Server</p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#0F172A] p-6 text-center">
          <AlertCircle className="w-12 h-12 text-[#EF4444] mb-3" />
          <h3 className="text-lg font-bold text-white mb-1">Editor Initialization Failed</h3>
          <p className="text-xs text-slate-400 max-w-md mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-4 py-2 bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-semibold rounded-md transition-all"
          >
            <RefreshCw size={14} /> Retry Connection
          </button>
        </div>
      )}

      {/* ONLYOFFICE Target Mount Container */}
      <div
        id="onlyoffice-canvas-target"
        ref={containerRef}
        style={{ width: '100%', height: '100%', flex: 1, minHeight: '600px' }}
      />
    </div>
  );
});

export default OnlyOfficeDocumentViewer;
