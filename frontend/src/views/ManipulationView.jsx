import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Edit3, Download, ShieldCheck, CheckCircle, AlertTriangle, ArrowRight,
  Loader2, Sparkles, RotateCcw, RotateCw, Folder, MousePointer,
  Type, AlignLeft, AlignCenter, AlignRight, Palette, Sliders, Check, X,
  FileText, Send, Bookmark, Eye, EyeOff, Columns, ZoomIn, ZoomOut,
  Maximize2, ArrowLeft, RefreshCw, Layers, History, Undo2, Redo2,
  Split, HelpCircle, ChevronDown, ChevronUp,
  Bold, Italic, Underline, Strikethrough, AlignJustify, Plus, Minus, Info,
  Subscript, Superscript, CaseSensitive, Eraser, PlusCircle
} from 'lucide-react';
import {
  uploadDocument, fetchDocument, runManipulation,
  undoManipulation, redoManipulation, getCheckpoints, getExportUrl
} from '../api/client';
import { getDocuments, createBlankDocument } from '../api/libraryApi';
import ScrollableDocumentViewer from '../components/ScrollableDocumentViewer';
import OnlyOfficeDocumentViewer from '../components/OnlyOfficeDocumentViewer';

export default function ManipulationView({ activeEngine, selectedDocument, onBackToLibrary }) {
  // Document State
  const [docSummary, setDocSummary] = useState(null);
  const [origPages, setOrigPages] = useState([]); // original unmodified pages backup

  // Editor Engine: 'onlyoffice' (Native WebAssembly Word Processor) | 'canvas' (Legacy PIL)
  const [editorEngine, setEditorEngine] = useState('onlyoffice');
  const onlyOfficeRef = useRef(null);

  // View & Inspection Modes
  const [viewMode, setViewMode] = useState('modified'); // 'modified' | 'original'
  const [highlightChanges, setHighlightChanges] = useState(true);

  // Selected Target Element (from ScrollableDocumentViewer)
  const [selectedPassage, setSelectedPassage] = useState(null);

  // Last Mutation Details for Spotlight & Region Comparison
  const [lastMutationResult, setLastMutationResult] = useState(null);
  const [showComparisonModal, setShowComparisonModal] = useState(false);

  // Antigravity Checkpoint Ledger & History
  const [checkpointsList, setCheckpointsList] = useState([]);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);

  // Chat State
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedDetails, setExpandedDetails] = useState({});

  // Ribbon Formatting State
  const [activeFontFamily, setActiveFontFamily] = useState('LiberationSerif');
  const [activeFontSize, setActiveFontSize] = useState(24);
  const [isBoldActive, setIsBoldActive] = useState(false);
  const [isItalicActive, setIsItalicActive] = useState(false);
  const [isUnderlineActive, setIsUnderlineActive] = useState(false);
  const [isStrikeActive, setIsStrikeActive] = useState(false);
  const [isSubscriptActive, setIsSubscriptActive] = useState(false);
  const [isSuperscriptActive, setIsSuperscriptActive] = useState(false);
  const [showCaseDropdown, setShowCaseDropdown] = useState(false);
  const [isHighlightActive, setIsHighlightActive] = useState(false);
  const [activeTextColor, setActiveTextColor] = useState('#0F172A');
  const [activeAlign, setActiveAlign] = useState('center');
  const [activeLineSpacing, setActiveLineSpacing] = useState(1.15);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customHexInput, setCustomHexInput] = useState('#0F172A');
  const [showInspector, setShowInspector] = useState(false);

  // Active selected element from AST
  const activeElement = useMemo(() => {
    if (!docSummary?.pages) return null;
    const targetPageIdx = selectedPassage ? selectedPassage.pageIdx : 0;
    const targetId = selectedPassage ? selectedPassage.elementId : 'heading_0_0';
    const page = docSummary.pages[targetPageIdx];
    return page?.elements?.find((e) => e.id === targetId) || null;
  }, [selectedPassage, docSummary]);

  // Two-way sync: Update Ribbon controls when a new element is clicked or AST mutates
  useEffect(() => {
    if (activeElement && activeElement.style) {
      const s = activeElement.style;
      if (s.font_family) setActiveFontFamily(s.font_family);
      if (s.font_size) setActiveFontSize(Math.round(s.font_size));
      setIsBoldActive(!!s.bold);
      setIsItalicActive(!!s.italic);
      setIsUnderlineActive(!!s.underline);
      setIsStrikeActive(!!s.strikethrough);
      setIsSubscriptActive(!!s.subscript);
      setIsSuperscriptActive(!!s.superscript);
      setIsHighlightActive(!!s.highlight);
      if (s.color) {
        setActiveTextColor(s.color);
        setCustomHexInput(s.color);
      }
      if (s.alignment) setActiveAlign(s.alignment);
      if (s.line_spacing) setActiveLineSpacing(s.line_spacing);
    }
  }, [activeElement]);

  // Library Document Picker Modal
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [libraryDocs, setLibraryDocs] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  const fileInputRef = useRef(null);
  const viewerRef = useRef(null);
  const chatBottomRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll sidecar chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Load selected document when passed from Library or auto-load first doc
  useEffect(() => {
    if (selectedDocument) {
      loadDocById(selectedDocument.document_id);
    } else if (!docSummary) {
      getDocuments({ limit: 1 })
        .then((res) => {
          if (res.documents && res.documents.length > 0) {
            loadDocById(res.documents[0].document_id);
          }
        })
        .catch(() => {});
    }
  }, [selectedDocument]);

  const loadDocById = async (docId) => {
    setIsLoading(true);
    setError(null);
    try {
      const summary = await fetchDocument(docId);
      setDocSummary(summary);
      setOrigPages(summary.pages ? JSON.parse(JSON.stringify(summary.pages)) : []);
      setSelectedPassage(null);
      setLastMutationResult(null);
      setCheckpointsList([]);
      setViewMode('modified');

      setMessages([
        {
          id: `welcome-${Date.now()}`,
          role: 'assistant',
          text: `**Loaded "${summary.filename}" (${summary.page_count} pages).**\n\nEnter natural language instructions to style, format, or restructure elements. Before each prompt, an invertible **Antigravity checkpoint** is recorded for instant rollback.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);

      const chk = await getCheckpoints(docId);
      setUndoCount(chk.undo_count || 0);
      setRedoCount(chk.redo_count || 0);
    } catch (err) {
      setError('Could not load document: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    try {
      const summary = await uploadDocument(file);
      setDocSummary(summary);
      setOrigPages(summary.pages ? JSON.parse(JSON.stringify(summary.pages)) : []);
      setSelectedPassage(null);
      setLastMutationResult(null);
      setCheckpointsList([]);
      setViewMode('modified');

      setMessages([
        {
          id: `welcome-${Date.now()}`,
          role: 'assistant',
          text: `**Uploaded "${summary.filename}" (${summary.page_count} pages).**\n\nHigh-fidelity layout extracted via native office compiler. Enter manipulation directives below or click any element on the document canvas to target it.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);

      const chk = await getCheckpoints(summary.document_id);
      setUndoCount(chk.undo_count || 0);
      setRedoCount(chk.redo_count || 0);
    } catch (err) {
      setError('Upload failed: ' + err.message);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleOpenLibrary = async () => {
    setShowLibraryModal(true);
    setLoadingDocs(true);
    try {
      const docs = await getDocuments();
      setLibraryDocs(docs || []);
    } catch (err) {
      setError('Could not load library documents: ' + err.message);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleCreateNewDoc = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await createBlankDocument('Untitled Document');
      await loadDocById(res.document_id);
      setShowLibraryModal(false);
    } catch (err) {
      setError('Failed to create new document: ' + err.message);
      setIsLoading(false);
    }
  };

  // Element selection handler from ScrollableDocumentViewer
  const handleSelectPassage = (passageData) => {
    setSelectedPassage(passageData);
  };

  // View Mode Switcher: toggle between Modified vs Original
  const handleSwitchViewMode = (mode) => {
    setViewMode(mode);
  };

  // Compute the current display document summary based on viewMode
  const currentDisplayDocSummary = useMemo(() => {
    if (!docSummary) return null;
    if (viewMode === 'original' && origPages.length > 0) {
      return {
        ...docSummary,
        pages: origPages,
      };
    }
    return docSummary;
  }, [docSummary, origPages, viewMode]);

  // Compute activeCitation for ScrollableDocumentViewer spotlighting
  const activeCitation = useMemo(() => {
    if (!highlightChanges || !lastMutationResult || !lastMutationResult.target_bbox) {
      return null;
    }
    return {
      pageIdx: lastMutationResult.page_idx ?? 0,
      bbox: lastMutationResult.target_bbox,
      label: '✦ MODIFIED & VERIFIED',
    };
  }, [highlightChanges, lastMutationResult]);

  // Execute Grounded Manipulation Directive
  const handleSendMessage = async (instructionText) => {
    const promptToSend = instructionText || inputText;
    if (!promptToSend.trim() || !docSummary) return;

    const targetPageIdx = selectedPassage ? selectedPassage.pageIdx : 0;
    const checkpointId = checkpointsList.length + 1;
    const checkpointLabel = `Checkpoint #${checkpointId}: "${promptToSend.slice(0, 30)}${promptToSend.length > 30 ? '...' : ''}"`;

    // 1. Append User Message
    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: promptToSend,
      targetElement: selectedPassage
        ? {
            id: selectedPassage.elementId,
            type: selectedPassage.type,
            text: selectedPassage.text,
            pageIdx: selectedPassage.pageIdx,
          }
        : null,
      checkpointId,
      checkpointLabel,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);
    setError(null);

    // Record checkpoint locally
    const newCheckpoint = {
      id: checkpointId,
      label: checkpointLabel,
      prompt: promptToSend,
      pageIdx: targetPageIdx,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setCheckpointsList((prev) => [...prev, newCheckpoint]);

    try {
      const res = await runManipulation({
        documentId: docSummary.document_id,
        pageIdx: targetPageIdx,
        instruction: promptToSend,
        targetId: selectedPassage?.elementId || null,
        targetText: selectedPassage?.selectedText || null,
        engine: activeEngine,
        renderEngine: 'canvas', // Non-destructive in-place patch
      });

      setUndoCount(res.undo_count || 0);
      setRedoCount(res.redo_count || 0);

      // Locate target element bbox for change spotlighting
      let targetBbox = res.target_bbox;
      if (!targetBbox && res.target_element_id && docSummary.pages?.[targetPageIdx]?.elements) {
        const found = docSummary.pages[targetPageIdx].elements.find((e) => e.id === res.target_element_id);
        if (found) targetBbox = found.bbox;
      }

      const mutResult = {
        ...res,
        page_idx: targetPageIdx,
        target_bbox: targetBbox,
        before_image_url: origPages[targetPageIdx]?.image_url || docSummary.pages[targetPageIdx]?.image_url,
      };

      setLastMutationResult(mutResult);
      setViewMode('modified');
      setHighlightChanges(true);

      // Forward planned mutation directly to ONLYOFFICE OneScript Bridge if active
      if (editorEngine === 'onlyoffice' && onlyOfficeRef.current) {
        const plansToExecute = (res.applied_plans && res.applied_plans.length > 0)
          ? res.applied_plans
          : [{
              target_id: res.target_element_id,
              target_text: res.target_text,
              operation: res.operation,
              property: res.property,
              value: res.value,
              updates: res.applied_plans?.[0]?.updates || (res.property ? { [res.property]: res.value } : {})
            }];

        plansToExecute.forEach((pPlan, pIdx) => {
          const targetEl = docSummary?.pages?.[targetPageIdx]?.elements?.find(
            (e) => e.id === pPlan.target_id
          );
          const resolvedTargetText = pPlan.target_text || targetEl?.text || (pIdx === 0 ? selectedPassage?.selectedText : null) || null;
          const resolvedUpdates = {
            ...(pPlan.updates || {}),
            ...(pPlan.property ? { [pPlan.property]: pPlan.value } : {}),
          };
          const resolvedNewText = resolvedUpdates.text || pPlan.value || '';

          onlyOfficeRef.current.executePluginAction({
            action: pPlan.operation || res.operation || 'SET_STYLE',
            paraIndex: selectedPassage?.paraIndex ?? res.target_index ?? null,
            targetText: resolvedTargetText,
            targetId: pPlan.target_id || res.target_element_id || selectedPassage?.elementId || null,
            property: pPlan.property || res.property,
            value: pPlan.value ?? res.value,
            updates: resolvedUpdates,
            newText: resolvedNewText,
            bold: (pPlan.property || res.property) === 'bold' ? (pPlan.value === true || String(pPlan.value).toLowerCase() === 'true') : Boolean(resolvedUpdates.bold),
            fontSize: (pPlan.property || res.property) === 'font_size' ? pPlan.value : (resolvedUpdates.font_size || null),
          });
        });
      }

      // Update docSummary page image & in-memory element styles
      if (res.re_rendered_image_url) {
        setDocSummary((prev) => {
          if (!prev || !prev.pages) return prev;
          const updatedPages = [...prev.pages];
          if (updatedPages[targetPageIdx]) {
            let updatedElements = updatedPages[targetPageIdx].elements || [];
            if (res.state_diff?.after && res.target_element_id) {
              const modifiedStyle = res.state_diff.after;
              updatedElements = updatedElements.map((el) => {
                if (el.id === res.target_element_id) {
                  return {
                    ...el,
                    style: { ...(el.style || {}), ...modifiedStyle },
                  };
                }
                return el;
              });
            }
            updatedPages[targetPageIdx] = {
              ...updatedPages[targetPageIdx],
              image_url: res.re_rendered_image_url,
              elements: updatedElements,
            };
          }
          return { ...prev, pages: updatedPages };
        });
      }

      // Scroll viewer to mutated element
      if (targetBbox && viewerRef.current) {
        viewerRef.current.scrollToPageAndBbox(targetPageIdx, targetBbox);
      }

      // Append Assistant Execution Message with Checkpoint Card
      const assistantMsg = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        status: res.success ? 'success' : 'failed',
        decisionStatus: res.success ? 'pending' : null,
        text: res.reasoning || (res.success ? 'Mutation applied and verified cleanly.' : 'Execution failed.'),
        checkpointId,
        checkpointLabel,
        manipResult: mutResult,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setError(err.message);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          status: 'error',
          text: `⚠️ Execution failed: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Revert / Rollback to a previous checkpoint
  const handleUndo = async () => {
    if (!docSummary || undoCount <= 0) return;
    setIsLoading(true);
    try {
      const targetPage = lastMutationResult ? lastMutationResult.page_idx : 0;
      const res = await undoManipulation({
        documentId: docSummary.document_id,
        pageIdx: targetPage,
        renderEngine: 'canvas',
      });
      if (res.success) {
        setUndoCount(res.undo_count);
        setRedoCount(res.redo_count);

        if (res.re_rendered_image_url) {
          setDocSummary((prev) => {
            if (!prev || !prev.pages) return prev;
            const updatedPages = [...prev.pages];
            if (updatedPages[targetPage]) {
              updatedPages[targetPage] = {
                ...updatedPages[targetPage],
                image_url: res.re_rendered_image_url,
              };
            }
            return { ...prev, pages: updatedPages };
          });
        }

        setLastMutationResult(null);

        if (editorEngine === 'onlyoffice' && onlyOfficeRef.current) {
          onlyOfficeRef.current.reload();
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `undo-${Date.now()}`,
            role: 'system',
            text: `↩️ **Rolled back to previous checkpoint.** (${res.undo_count} undo steps remaining)`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }
        ]);
      }
    } catch (err) {
      setError('Undo failed: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Redo previously undone checkpoint
  const handleRedo = async () => {
    if (!docSummary || redoCount <= 0) return;
    setIsLoading(true);
    try {
      const targetPage = lastMutationResult ? lastMutationResult.page_idx : 0;
      const res = await redoManipulation({
        documentId: docSummary.document_id,
        pageIdx: targetPage,
        renderEngine: 'canvas',
      });
      if (res.success) {
        setUndoCount(res.undo_count);
        setRedoCount(res.redo_count);

        if (res.re_rendered_image_url) {
          setDocSummary((prev) => {
            if (!prev || !prev.pages) return prev;
            const updatedPages = [...prev.pages];
            if (updatedPages[targetPage]) {
              updatedPages[targetPage] = {
                ...updatedPages[targetPage],
                image_url: res.re_rendered_image_url,
              };
            }
            return { ...prev, pages: updatedPages };
          });
        }

        if (editorEngine === 'onlyoffice' && onlyOfficeRef.current) {
          onlyOfficeRef.current.reload();
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `redo-${Date.now()}`,
            role: 'system',
            text: `🔁 **Reapplied checkpoint.** (${res.redo_count} redo steps remaining)`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }
        ]);
      }
    } catch (err) {
      setError('Redo failed: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDetails = (msgId) => {
    setExpandedDetails((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const handleAcceptMutation = (msgId) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, decisionStatus: 'accepted' } : m))
    );
    // Remove the highlight spotlight so the clean document is displayed
    setHighlightChanges(false);
  };

  const handleRejectMutation = async (msgId) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, decisionStatus: 'rejected' } : m))
    );
    setHighlightChanges(false);
    await handleUndo();
  };

  const getMinimalActionSummary = (manipResult) => {
    if (!manipResult) return 'Document updated cleanly';
    const prop = manipResult.property;
    const val = manipResult.value;
    if (prop === 'color') return `Set text color to ${val}`;
    if (prop === 'font_size') return `Changed font size to ${val}pt`;
    if (prop === 'font_family') return `Changed font family to ${val}`;
    if (prop === 'bold') return (val === true || String(val).toLowerCase() === 'true') ? 'Applied bold emphasis' : 'Removed bold emphasis';
    if (prop === 'italic') return (val === true || String(val).toLowerCase() === 'true') ? 'Applied italic styling' : 'Removed italic styling';
    if (prop === 'underline') return (val === true || String(val).toLowerCase() === 'true') ? 'Applied underline' : 'Removed underline';
    if (prop === 'strikethrough') return (val === true || String(val).toLowerCase() === 'true') ? 'Applied strikethrough' : 'Removed strikethrough';
    if (prop === 'alignment') return `Aligned text to ${val}`;
    if (prop === 'highlight') return (val === true || String(val).toLowerCase() === 'true') ? 'Highlighted target region' : 'Removed highlight';
    if (prop && val) return `Updated ${prop} → ${val}`;
    return 'Document updated cleanly';
  };

  const handleRibbonAction = async (property, value) => {
    if (!docSummary) return;

    const targetPageIdx = selectedPassage ? selectedPassage.pageIdx : 0;
    const targetId = selectedPassage ? selectedPassage.elementId : 'heading_0_0';
    const checkpointId = checkpointsList.length + 1;
    const checkpointLabel = `Ribbon: Set ${property} = ${value} on ${targetId}`;

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: `Ribbon Action: Set ${property} to ${value}`,
      targetElement: selectedPassage
        ? {
            id: selectedPassage.elementId,
            type: selectedPassage.type,
            text: selectedPassage.text,
            pageIdx: selectedPassage.pageIdx,
          }
        : { id: 'heading_0_0', type: 'heading', pageIdx: 0, text: 'Title' },
      checkpointId,
      checkpointLabel,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setError(null);

    const newCheckpoint = {
      id: checkpointId,
      label: checkpointLabel,
      prompt: checkpointLabel,
      pageIdx: targetPageIdx,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setCheckpointsList((prev) => [...prev, newCheckpoint]);

    const targetSubText = selectedPassage?.selectedText || null;
    const instructionText = property === 'clear_style'
      ? `Clear all formatting on ${targetId}`
      : (targetSubText
          ? `Set ${property} to ${value} on "${targetSubText}" in ${targetId}`
          : `Set ${property} to ${value} on ${targetId}`);

    try {
      const res = await runManipulation({
        documentId: docSummary.document_id,
        pageIdx: targetPageIdx,
        instruction: instructionText,
        targetId,
        targetText: targetSubText,
        properties: property === 'clear_style' ? {} : { [property]: value },
        engine: activeEngine,
        renderEngine: 'canvas',
      });

      setUndoCount(res.undo_count || 0);
      setRedoCount(res.redo_count || 0);

      let targetBbox = res.target_bbox;
      if (!targetBbox && res.target_element_id && docSummary.pages?.[targetPageIdx]?.elements) {
        const found = docSummary.pages[targetPageIdx].elements.find((e) => e.id === res.target_element_id);
        if (found) targetBbox = found.bbox;
      }

      const mutResult = {
        ...res,
        page_idx: targetPageIdx,
        target_bbox: targetBbox,
        before_image_url: origPages[targetPageIdx]?.image_url || docSummary.pages[targetPageIdx]?.image_url,
      };

      setLastMutationResult(mutResult);
      setViewMode('modified');
      setHighlightChanges(true);

      // Forward planned mutation directly to ONLYOFFICE OneScript Bridge if active
      if (editorEngine === 'onlyoffice' && onlyOfficeRef.current) {
        const plansToExecute = (res.applied_plans && res.applied_plans.length > 0)
          ? res.applied_plans
          : [{
              target_id: res.target_element_id,
              target_text: res.target_text,
              operation: res.operation,
              property: res.property,
              value: res.value,
              updates: res.applied_plans?.[0]?.updates || (res.property ? { [res.property]: res.value } : {})
            }];

        plansToExecute.forEach((pPlan, pIdx) => {
          const targetEl = docSummary?.pages?.[targetPageIdx]?.elements?.find(
            (e) => e.id === pPlan.target_id
          );
          const resolvedTargetText = pPlan.target_text || targetEl?.text || (pIdx === 0 ? selectedPassage?.selectedText : null) || null;
          const resolvedUpdates = {
            ...(pPlan.updates || {}),
            ...(pPlan.property ? { [pPlan.property]: pPlan.value } : {}),
          };
          const resolvedNewText = resolvedUpdates.text || pPlan.value || '';

          onlyOfficeRef.current.executePluginAction({
            action: pPlan.operation || res.operation || 'SET_STYLE',
            paraIndex: selectedPassage?.paraIndex ?? res.target_index ?? null,
            targetText: resolvedTargetText,
            targetId: pPlan.target_id || res.target_element_id || selectedPassage?.elementId || null,
            property: pPlan.property || res.property,
            value: pPlan.value ?? res.value,
            updates: resolvedUpdates,
            newText: resolvedNewText,
            bold: (pPlan.property || res.property) === 'bold' ? (pPlan.value === true || String(pPlan.value).toLowerCase() === 'true') : Boolean(resolvedUpdates.bold),
            fontSize: (pPlan.property || res.property) === 'font_size' ? pPlan.value : (resolvedUpdates.font_size || null),
          });
        });
      }

      if (res.re_rendered_image_url) {
        setDocSummary((prev) => {
          if (!prev || !prev.pages) return prev;
          const updatedPages = [...prev.pages];
          if (updatedPages[targetPageIdx]) {
            const updatedElements = (updatedPages[targetPageIdx].elements || []).map((el) => {
              if (el.id === targetId) {
                if (property === 'clear_style') {
                  return {
                    ...el,
                    style: { font_size: 12, font_family: 'LiberationSerif', color: '#0F172A', alignment: 'left' },
                    metadata: { ...(el.metadata || {}), spans: [] }
                  };
                }
                if (targetSubText) {
                  const existingSpans = (el.metadata?.spans || []).filter(
                    (s) => s.text?.toLowerCase() !== targetSubText.toLowerCase()
                  );
                  return {
                    ...el,
                    metadata: {
                      ...(el.metadata || {}),
                      spans: [...existingSpans, { text: targetSubText, style: { [property]: value } }]
                    }
                  };
                }
                return {
                  ...el,
                  style: {
                    ...(el.style || {}),
                    [property]: value,
                  },
                };
              }
              return el;
            });
            updatedPages[targetPageIdx] = {
              ...updatedPages[targetPageIdx],
              image_url: res.re_rendered_image_url,
              elements: updatedElements,
            };
          }
          return { ...prev, pages: updatedPages };
        });
      }

      if (targetBbox && viewerRef.current) {
        viewerRef.current.scrollToPageAndBbox(targetPageIdx, targetBbox);
      }

      const assistantMsg = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        status: res.success ? 'success' : 'failed',
        decisionStatus: res.success ? 'pending' : null,
        text: res.reasoning || (res.success ? `Ribbon formatted ${property} to ${value} cleanly.` : 'Execution failed.'),
        checkpointId,
        checkpointLabel,
        manipResult: mutResult,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="agentic-understanding-container portfolio-root">
      {/* Hidden File Input for .docx Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.doc"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {/* Top Context & Status Bar */}
      <div className="understanding-top-bar neo-window">
        <div className="neo-window-header">
          <div className="neo-window-dots">
            <span className="dot-red" />
            <span className="dot-yellow" />
            <span className="dot-green" />
          </div>
          <span className="neo-window-title font-mono">workspace.manipulation // antigravity_checkpoints</span>
        </div>

        <div className="understanding-top-bar-body flex items-center justify-between p-3" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem' }}>
          <div className="top-bar-left" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {onBackToLibrary && (
              <button
                type="button"
                className="neo-btn-back"
                onClick={onBackToLibrary}
                title="Return to Document Library"
              >
                <ArrowLeft size={14} />
                <span>&larr; Library</span>
              </button>
            )}

            <div>
              <h2 className="workspace-heading font-mono text-base font-bold" style={{ margin: 0, fontSize: '0.95rem' }}>
                {docSummary?.filename || 'Document Manipulation Studio'}
              </h2>
              <div className="workspace-subheading font-mono text-xs opacity-75" style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                {docSummary
                  ? `Active Document \u2022 ${docSummary.page_count} pages \u2022 Invertible Mutation Calculus`
                  : 'Grounded document manipulation \u2022 Select or upload a Word document'}
              </div>
            </div>
          </div>

          {/* Top Controls: Undo/Redo, Library, Upload, Export */}
          <div className="top-bar-right" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Undo / Redo */}
            <button
              type="button"
              className="neo-btn"
              onClick={handleUndo}
              disabled={isLoading || undoCount <= 0}
              title={undoCount > 0 ? `Undo (${undoCount} checkpoints)` : 'No checkpoint to undo'}
              style={{ opacity: undoCount > 0 ? 1 : 0.45 }}
            >
              <RotateCcw size={12} />
              <span>Undo</span>
              {undoCount > 0 && <span className="badge-count">{undoCount}</span>}
            </button>

            <button
              type="button"
              className="neo-btn"
              onClick={handleRedo}
              disabled={isLoading || redoCount <= 0}
              title={redoCount > 0 ? `Redo (${redoCount} steps)` : 'No steps to redo'}
              style={{ opacity: redoCount > 0 ? 1 : 0.45 }}
            >
              <RotateCw size={12} />
              <span>Redo</span>
              {redoCount > 0 && <span className="badge-count" style={{ background: '#38BDF8' }}>{redoCount}</span>}
            </button>

            <button
              type="button"
              className="neo-btn"
              onClick={handleCreateNewDoc}
              disabled={isLoading}
              title="Create Fresh Blank Document"
            >
              <PlusCircle size={13} color="#38BDF8" />
              <span>New Doc</span>
            </button>

            <button
              type="button"
              className="neo-btn"
              onClick={handleOpenLibrary}
              title="Open Document from Library"
            >
              <Folder size={13} />
              <span>Library</span>
            </button>

            <button
              type="button"
              className="neo-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Upload New Word Document"
            >
              <Edit3 size={13} />
              <span>Upload .docx</span>
            </button>

            {docSummary && (
              <a
                href={getExportUrl(docSummary.document_id)}
                download
                className="neo-btn-primary"
                style={{ textDecoration: 'none' }}
                title="Download Modified Document"
              >
                <Download size={13} />
                <span>Export .docx</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="system-error-banner-clean">
          <AlertTriangle size={15} />
          <span>{error}</span>
          <button type="button" className="error-close-btn" onClick={() => setError(null)}>
            &times;
          </button>
        </div>
      )}

      {/* Split Workspace Layout */}
      <div className="agentic-split-layout">
        {/* =========================================================================
            LEFT PANE: SCROLLABLE MAIN DOCUMENT WINDOW
            ========================================================================= */}
        <div className="viewer-pane">
          {/* Document Editor Ribbon Toolbar (Active only in Classic Canvas mode; deprecated in ONLYOFFICE mode) */}
          {editorEngine === 'canvas' && (
            <div className="editor-ribbon-bar">
              {/* History Controls */}
            <div className="ribbon-group" title="Checkpoint History">
              <button
                type="button"
                onClick={handleUndo}
                disabled={isLoading || undoCount <= 0}
                title={undoCount > 0 ? `Undo (${undoCount} checkpoints)` : 'No checkpoint to undo'}
                className="ribbon-icon-btn"
              >
                <RotateCcw size={13} />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={isLoading || redoCount <= 0}
                title={redoCount > 0 ? `Redo (${redoCount} steps)` : 'No steps to redo'}
                className="ribbon-icon-btn"
              >
                <RotateCw size={13} />
              </button>
            </div>

            <div className="ribbon-divider" />

            {/* Font Family & Size Selectors */}
            <div className="ribbon-group">
              <select
                className="ribbon-select font-family-select"
                value={activeFontFamily}
                onChange={(e) => {
                  setActiveFontFamily(e.target.value);
                  handleRibbonAction('font_family', e.target.value);
                }}
                title="Font Family"
              >
                <option value="LiberationSerif">Liberation Serif (Standard)</option>
                <option value="LiberationSans">Liberation Sans (Modern)</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Arial">Arial</option>
                <option value="Courier New">Courier New (Mono)</option>
                <option value="DejaVu Sans">DejaVu Sans</option>
              </select>

              <div className="ribbon-size-group">
                <select
                  className="ribbon-select font-size-select"
                  value={activeFontSize}
                  onChange={(e) => {
                    const sz = parseInt(e.target.value, 10);
                    setActiveFontSize(sz);
                    handleRibbonAction('font_size', sz);
                  }}
                  title="Font Size"
                >
                  {[8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 48].map((s) => (
                    <option key={s} value={s}>{s} pt</option>
                  ))}
                </select>

                <button
                  type="button"
                  className="ribbon-stepper-btn"
                  onClick={() => {
                    const newSz = Math.max(8, activeFontSize - 2);
                    setActiveFontSize(newSz);
                    handleRibbonAction('font_size', newSz);
                  }}
                  title="Decrease Font Size (2pt)"
                >
                  <Minus size={11} />
                </button>
                <button
                  type="button"
                  className="ribbon-stepper-btn"
                  onClick={() => {
                    const newSz = Math.min(72, activeFontSize + 2);
                    setActiveFontSize(newSz);
                    handleRibbonAction('font_size', newSz);
                  }}
                  title="Increase Font Size (2pt)"
                >
                  <Plus size={11} />
                </button>
              </div>
            </div>

            <div className="ribbon-divider" />

            {/* Typography Weights & Emphasis */}
            <div className="ribbon-group">
              <button
                type="button"
                className={`ribbon-btn-toggle ${isBoldActive ? 'active' : ''}`}
                onClick={() => {
                  const nxt = !isBoldActive;
                  setIsBoldActive(nxt);
                  handleRibbonAction('bold', nxt);
                }}
                title={isBoldActive ? 'Bold (Active)' : 'Bold'}
              >
                <Bold size={13} />
              </button>
              <button
                type="button"
                className={`ribbon-btn-toggle ${isItalicActive ? 'active' : ''}`}
                onClick={() => {
                  const nxt = !isItalicActive;
                  setIsItalicActive(nxt);
                  handleRibbonAction('italic', nxt);
                }}
                title={isItalicActive ? 'Italic (Active)' : 'Italic'}
              >
                <Italic size={13} />
              </button>
              <button
                type="button"
                className={`ribbon-btn-toggle ${isUnderlineActive ? 'active' : ''}`}
                onClick={() => {
                  const nxt = !isUnderlineActive;
                  setIsUnderlineActive(nxt);
                  handleRibbonAction('underline', nxt);
                }}
                title={isUnderlineActive ? 'Underline (Active)' : 'Underline'}
              >
                <Underline size={13} />
              </button>
              <button
                type="button"
                className={`ribbon-btn-toggle ${isStrikeActive ? 'active' : ''}`}
                onClick={() => {
                  const nxt = !isStrikeActive;
                  setIsStrikeActive(nxt);
                  handleRibbonAction('strikethrough', nxt);
                }}
                title={isStrikeActive ? 'Strikethrough (Active)' : 'Strikethrough'}
              >
                <Strikethrough size={13} />
              </button>
              <button
                type="button"
                className={`ribbon-btn-toggle ${isSubscriptActive ? 'active' : ''}`}
                onClick={() => {
                  const nxt = !isSubscriptActive;
                  setIsSubscriptActive(nxt);
                  if (nxt) setIsSuperscriptActive(false);
                  handleRibbonAction('subscript', nxt);
                }}
                title={isSubscriptActive ? 'Subscript (Active)' : 'Subscript'}
              >
                <Subscript size={13} />
              </button>
              <button
                type="button"
                className={`ribbon-btn-toggle ${isSuperscriptActive ? 'active' : ''}`}
                onClick={() => {
                  const nxt = !isSuperscriptActive;
                  setIsSuperscriptActive(nxt);
                  if (nxt) setIsSubscriptActive(false);
                  handleRibbonAction('superscript', nxt);
                }}
                title={isSuperscriptActive ? 'Superscript (Active)' : 'Superscript'}
              >
                <Superscript size={13} />
              </button>
              <div style={{ position: 'relative', display: 'inline-flex' }}>
                <button
                  type="button"
                  className={`ribbon-btn-toggle ${showCaseDropdown ? 'active' : ''}`}
                  onClick={() => setShowCaseDropdown(!showCaseDropdown)}
                  title="Change Case (UPPERCASE, lowercase, Capitalize)"
                >
                  <CaseSensitive size={14} />
                </button>
                {showCaseDropdown && (
                  <div className="ribbon-case-dropdown">
                    <button
                      type="button"
                      className="case-dropdown-item"
                      onClick={() => {
                        setShowCaseDropdown(false);
                        handleRibbonAction('text_case', 'uppercase');
                      }}
                    >
                      UPPERCASE
                    </button>
                    <button
                      type="button"
                      className="case-dropdown-item"
                      onClick={() => {
                        setShowCaseDropdown(false);
                        handleRibbonAction('text_case', 'lowercase');
                      }}
                    >
                      lowercase
                    </button>
                    <button
                      type="button"
                      className="case-dropdown-item"
                      onClick={() => {
                        setShowCaseDropdown(false);
                        handleRibbonAction('text_case', 'capitalize');
                      }}
                    >
                      Capitalize Each Word
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="ribbon-btn-toggle"
                onClick={() => {
                  setIsBoldActive(false);
                  setIsItalicActive(false);
                  setIsUnderlineActive(false);
                  setIsStrikeActive(false);
                  setIsSubscriptActive(false);
                  setIsSuperscriptActive(false);
                  setIsHighlightActive(false);
                  setActiveTextColor('#0F172A');
                  handleRibbonAction('clear_style', true);
                }}
                title="Clear All Formatting (Reset to Default)"
              >
                <Eraser size={13} />
              </button>
            </div>

            <div className="ribbon-divider" />

            {/* Color Tools: Font Color Bar & Highlight */}
            <div className="ribbon-group" style={{ position: 'relative' }}>
              <div className="ribbon-color-btn-wrapper">
                <button
                  type="button"
                  className="ribbon-color-trigger-btn"
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  title={`Text Color (Current: ${activeTextColor})`}
                >
                  <Type size={13} />
                  <span className="ribbon-color-indicator-bar" style={{ backgroundColor: activeTextColor }} />
                </button>

                {/* Office Style Popover Color Palette */}
                {showColorPicker && (
                  <div className="ribbon-color-dropdown">
                    <div className="color-dropdown-title">Theme Colors</div>
                    <div className="color-palette-grid">
                      {[
                        { name: 'Slate Black', hex: '#0F172A' },
                        { name: 'Dark Slate', hex: '#334155' },
                        { name: 'Muted Gray', hex: '#64748B' },
                        { name: 'Red', hex: '#EF4444' },
                        { name: 'Dark Red', hex: '#B91C1C' },
                        { name: 'Orange', hex: '#F97316' },
                        { name: 'Yellow', hex: '#EAB308' },
                        { name: 'Amber', hex: '#F59E0B' },
                        { name: 'Emerald', hex: '#10B981' },
                        { name: 'Dark Green', hex: '#047857' },
                        { name: 'Sky Blue', hex: '#0EA5E9' },
                        { name: 'Indigo', hex: '#6366F1' },
                        { name: 'Purple', hex: '#8B5CF6' },
                        { name: 'Pink', hex: '#EC4899' },
                      ].map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          className={`color-swatch-dot ${activeTextColor === c.hex ? 'active-swatch' : ''}`}
                          style={{ backgroundColor: c.hex }}
                          onClick={() => {
                            setActiveTextColor(c.hex);
                            setShowColorPicker(false);
                            handleRibbonAction('color', c.hex);
                          }}
                          title={`${c.name} (${c.hex})`}
                        />
                      ))}
                    </div>

                    <div className="color-custom-row">
                      <input
                        type="text"
                        className="color-hex-input font-mono"
                        placeholder="#HEX"
                        value={customHexInput}
                        onChange={(e) => setCustomHexInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && customHexInput.trim()) {
                            const val = customHexInput.startsWith('#') ? customHexInput : `#${customHexInput}`;
                            setActiveTextColor(val);
                            setShowColorPicker(false);
                            handleRibbonAction('color', val);
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="color-apply-btn"
                        onClick={() => {
                          if (customHexInput.trim()) {
                            const val = customHexInput.startsWith('#') ? customHexInput : `#${customHexInput}`;
                            setActiveTextColor(val);
                            setShowColorPicker(false);
                            handleRibbonAction('color', val);
                          }
                        }}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Highlight Toggle */}
              <button
                type="button"
                className={`ribbon-btn-toggle ${isHighlightActive ? 'active' : ''}`}
                onClick={() => {
                  const nxt = !isHighlightActive;
                  setIsHighlightActive(nxt);
                  handleRibbonAction('highlight', nxt);
                }}
                title={isHighlightActive ? 'Remove Highlight' : 'Highlight Text (#FEF08A)'}
              >
                <Palette size={13} />
              </button>
            </div>

            <div className="ribbon-divider" />

            {/* Alignment */}
            <div className="ribbon-group">
              <button
                type="button"
                className={`ribbon-btn-toggle ${activeAlign === 'left' ? 'active' : ''}`}
                onClick={() => {
                  setActiveAlign('left');
                  handleRibbonAction('alignment', 'left');
                }}
                title="Align Left"
              >
                <AlignLeft size={13} />
              </button>
              <button
                type="button"
                className={`ribbon-btn-toggle ${activeAlign === 'center' ? 'active' : ''}`}
                onClick={() => {
                  setActiveAlign('center');
                  handleRibbonAction('alignment', 'center');
                }}
                title="Align Center"
              >
                <AlignCenter size={13} />
              </button>
              <button
                type="button"
                className={`ribbon-btn-toggle ${activeAlign === 'right' ? 'active' : ''}`}
                onClick={() => {
                  setActiveAlign('right');
                  handleRibbonAction('alignment', 'right');
                }}
                title="Align Right"
              >
                <AlignRight size={13} />
              </button>
              <button
                type="button"
                className={`ribbon-btn-toggle ${activeAlign === 'justify' ? 'active' : ''}`}
                onClick={() => {
                  setActiveAlign('justify');
                  handleRibbonAction('alignment', 'justify');
                }}
                title="Justify"
              >
                <AlignJustify size={13} />
              </button>
            </div>

            <div className="ribbon-divider" />

            {/* Line Spacing */}
            <div className="ribbon-group" title="Line Spacing">
              <select
                className="ribbon-select ribbon-line-spacing-select"
                value={activeLineSpacing}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setActiveLineSpacing(val);
                  handleRibbonAction('line_spacing', val);
                }}
                title="Line Spacing"
              >
                <option value={1.0}>1.0x</option>
                <option value={1.15}>1.15x</option>
                <option value={1.5}>1.5x</option>
                <option value={2.0}>2.0x</option>
              </select>
            </div>

            <div className="ribbon-divider" />

            {/* Active Target Indicator & Format Inspector Button */}
            <div className="ribbon-target-group">
              <button
                type="button"
                className={`ribbon-target-pill ${selectedPassage ? 'target-active' : ''}`}
                onClick={() => setShowInspector(!showInspector)}
                title="Click to toggle full Format & Style Inspector"
              >
                <span className="dot-indicator" style={{ background: selectedPassage ? '#10B981' : '#EAB308' }} />
                <span className="target-pill-text">
                  {selectedPassage
                    ? (selectedPassage.selectedText
                        ? `🎯 ${selectedPassage.type}: “${selectedPassage.selectedText.length > 18 ? selectedPassage.selectedText.slice(0, 16) + '…' : selectedPassage.selectedText}”`
                        : `${selectedPassage.type}: ${selectedPassage.elementId}`)
                    : 'Target: Document Title'}
                </span>
                <Sliders size={11} className="target-inspect-icon" />
              </button>

              {selectedPassage && (
                <button
                  type="button"
                  className="clear-target-btn"
                  onClick={() => setSelectedPassage(null)}
                  title="Deselect element"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
          )}

          {/* Main Document Window Manipulation Toolbar */}
          <div className="manipulation-toolbar">
            <div className="toolbar-controls-group">
              {/* Target Indicator Pill */}
              <div className="ribbon-target-group">
                <button
                  type="button"
                  className={`ribbon-target-pill ${selectedPassage ? 'target-active' : ''}`}
                  onClick={() => setShowInspector(!showInspector)}
                  title="Click to toggle full Format & Style Inspector"
                >
                  <span className="dot-indicator" style={{ background: selectedPassage ? '#10B981' : '#EAB308' }} />
                  <span className="target-pill-text">
                    {selectedPassage
                      ? (selectedPassage.selectedText
                          ? `🎯 ${selectedPassage.type}: “${selectedPassage.selectedText.length > 18 ? selectedPassage.selectedText.slice(0, 16) + '…' : selectedPassage.selectedText}”`
                          : `${selectedPassage.type}: ${selectedPassage.elementId}`)
                      : 'Target: Document Title'}
                  </span>
                  <Sliders size={11} className="target-inspect-icon" />
                </button>

                {selectedPassage && (
                  <button
                    type="button"
                    className="clear-target-btn"
                    onClick={() => setSelectedPassage(null)}
                    title="Deselect element"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* ONLYOFFICE Document Info Badge */}
              {editorEngine === 'onlyoffice' && docSummary && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--text-dim)', paddingLeft: '0.5rem' }}>
                  <FileText size={12} color="#38BDF8" />
                  <span style={{ fontWeight: 500, color: 'var(--text-normal)' }}>{docSummary.filename}</span>
                  <span style={{ opacity: 0.6 }}>({docSummary.page_count} pages)</span>
                </div>
              )}

              {/* Legacy Canvas Controls (Shown only in Classic Canvas mode) */}
              {editorEngine === 'canvas' && (
                <>
                  <div className="toolbar-segmented-group">
                    <button
                      type="button"
                      className={`toolbar-segmented-btn ${viewMode === 'modified' ? 'active' : ''}`}
                      onClick={() => handleSwitchViewMode('modified')}
                      title="Show Modified Document (Current State)"
                    >
                      <Sparkles size={11} />
                      <span>Current (Modified)</span>
                    </button>
                    <button
                      type="button"
                      className={`toolbar-segmented-btn ${viewMode === 'original' ? 'active' : ''}`}
                      onClick={() => handleSwitchViewMode('original')}
                      title="Show Original Unmodified Document"
                    >
                      <History size={11} />
                      <span>Original (Before)</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    className={`toolbar-toggle-btn ${highlightChanges ? 'active' : ''}`}
                    onClick={() => setHighlightChanges((h) => !h)}
                    title="Toggle visual spotlight on modified elements"
                  >
                    {highlightChanges ? <Eye size={12} /> : <EyeOff size={12} />}
                    <span>Highlight Changes</span>
                  </button>

                  <button
                    type="button"
                    className="toolbar-compare-btn"
                    disabled={!lastMutationResult}
                    onClick={() => setShowComparisonModal(true)}
                    title={lastMutationResult ? 'Open Before vs After comparison of the modified region' : 'Execute an edit to enable comparison'}
                  >
                    <Split size={12} />
                    <span>Compare Region</span>
                  </button>
                </>
              )}
            </div>

            {/* Checkpoint Status Indicator */}
            {checkpointsList.length > 0 && (
              <div className="toolbar-controls-group" style={{ fontSize: '0.70rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                <Bookmark size={12} color="#A78BFA" />
                <span>{checkpointsList.length} Checkpoints Recorded</span>
              </div>
            )}

            {/* Editor Engine Switcher: ONLYOFFICE vs Classic Canvas */}
            <div className="toolbar-controls-group" style={{ marginLeft: 'auto' }}>
              <div style={{ display: 'inline-flex', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  style={{
                    fontSize: '0.68rem',
                    padding: '2px 8px',
                    borderRadius: '3px',
                    background: editorEngine === 'onlyoffice' ? 'var(--primary)' : 'transparent',
                    color: editorEngine === 'onlyoffice' ? 'white' : 'var(--text-dim)',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                  onClick={() => setEditorEngine('onlyoffice')}
                  title="Switch to Native ONLYOFFICE WebAssembly Word Processor (Zero Lag)"
                >
                  ⚡ ONLYOFFICE Native
                </button>
                <button
                  type="button"
                  style={{
                    fontSize: '0.68rem',
                    padding: '2px 8px',
                    borderRadius: '3px',
                    background: editorEngine === 'canvas' ? 'var(--primary)' : 'transparent',
                    color: editorEngine === 'canvas' ? 'white' : 'var(--text-dim)',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                  onClick={() => setEditorEngine('canvas')}
                  title="Switch to Legacy Static Canvas Rasterizer"
                >
                  Classic Canvas
                </button>
              </div>
            </div>
          </div>

          {/* Document Workspace Center View */}
          {editorEngine === 'onlyoffice' && docSummary ? (
            <OnlyOfficeDocumentViewer
              ref={onlyOfficeRef}
              documentId={docSummary?.document_id}
              onSelectionChange={(sel) => {
                if (sel && (sel.text || sel.paraIndex !== null || sel.paraText)) {
                  const displayText = sel.text || (sel.paraText ? sel.paraText.trim().substring(0, 45) + (sel.paraText.length > 45 ? '...' : '') : `Paragraph #${(sel.paraIndex ?? 0) + 1}`);
                  setSelectedPassage({
                    elementId: sel.paraIndex !== null ? `paragraph_0_${sel.paraIndex}` : 'selection',
                    paraIndex: sel.paraIndex,
                    type: 'paragraph',
                    text: displayText,
                    selectedText: sel.text || null,
                    fullParaText: sel.paraText || null,
                    pageIdx: 0,
                  });
                } else {
                  setSelectedPassage(null);
                }
              }}
            />
          ) : (
            <ScrollableDocumentViewer
              ref={viewerRef}
              docSummary={currentDisplayDocSummary}
              selectedPassage={selectedPassage}
              onSelectPassage={handleSelectPassage}
              onClearPassage={() => setSelectedPassage(null)}
              activeCitation={activeCitation}
              onAskAboutPassage={() => textareaRef.current?.focus()}
            />
          )}
        </div>

        {/* =========================================================================
            RIGHT PANE: AGENTIC MANIPULATION CHAT SIDECAR
            ========================================================================= */}
        <div className="sidecar-pane">
          <div className="agentic-sidecar neo-window">
            {/* Sidecar Window Header */}
            <div className="sidecar-header">
              <div className="agent-identity">
                <div className="agent-avatar-clean">
                  <Edit3 size={14} />
                </div>
                <div>
                  <div className="agent-name">Document Manipulation Agent</div>
                  <div className="agent-status-tag">
                    <span className="clean-status-dot" />
                    <span>Invertible Mutation Calculus &bull; {activeEngine}</span>
                  </div>
                </div>
              </div>

              <div className="sidecar-actions">
                <button
                  type="button"
                  className={`action-icon-btn ${showInspector ? 'active' : ''}`}
                  onClick={() => setShowInspector(!showInspector)}
                  title="Toggle Format & Style Inspector"
                >
                  <Sliders size={13} />
                </button>
                <button
                  type="button"
                  className="action-icon-btn"
                  onClick={handleUndo}
                  disabled={undoCount <= 0}
                  title={`Undo (${undoCount})`}
                >
                  <RotateCcw size={13} />
                </button>
                <button
                  type="button"
                  className="action-icon-btn"
                  onClick={handleRedo}
                  disabled={redoCount <= 0}
                  title={`Redo (${redoCount})`}
                >
                  <RotateCw size={13} />
                </button>
              </div>
            </div>

            {/* Format & Style Inspector Card */}
            {(showInspector || selectedPassage) && activeElement && (
              <div className="format-inspector-card">
                <div className="inspector-header">
                  <div className="inspector-title">
                    <Sliders size={12} color="#38BDF8" />
                    <span>Format Inspector &bull; <strong className="font-mono" style={{ color: '#38BDF8' }}>{activeElement.id}</strong></span>
                  </div>
                  <div className="inspector-header-actions">
                    <span className="inspector-type-pill">{activeElement.type}</span>
                    <button
                      type="button"
                      className="inspector-close-btn"
                      onClick={() => {
                        setSelectedPassage(null);
                        setShowInspector(false);
                      }}
                      title="Close Inspector"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>

                {/* Text preview snippet */}
                {activeElement.text && (
                  <div className="inspector-text-preview" title={activeElement.text}>
                    &ldquo;{activeElement.text.length > 70 ? `${activeElement.text.slice(0, 70)}...` : activeElement.text}&rdquo;
                  </div>
                )}

                {/* Typography & Layout Attributes Grid */}
                <div className="inspector-grid">
                  <div className="inspector-cell">
                    <span className="cell-label">Font Family</span>
                    <span className="cell-value font-mono">{activeFontFamily}</span>
                  </div>
                  <div className="inspector-cell">
                    <span className="cell-label">Font Size</span>
                    <span className="cell-value font-mono">{activeFontSize} pt</span>
                  </div>
                  <div className="inspector-cell">
                    <span className="cell-label">Text Color</span>
                    <span className="cell-value font-mono" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: activeTextColor, display: 'inline-block', border: '1px solid #475569' }} />
                      {activeTextColor}
                    </span>
                  </div>
                  <div className="inspector-cell">
                    <span className="cell-label">Alignment</span>
                    <span className="cell-value font-mono" style={{ textTransform: 'capitalize' }}>{activeAlign}</span>
                  </div>
                  <div className="inspector-cell">
                    <span className="cell-label">Styles</span>
                    <span className="cell-value font-mono">
                      {[
                        isBoldActive && 'Bold',
                        isItalicActive && 'Italic',
                        isUnderlineActive && 'Underline',
                        isStrikeActive && 'Strike',
                        isSubscriptActive && 'Subscript',
                        isSuperscriptActive && 'Superscript',
                        !isBoldActive && !isItalicActive && !isUnderlineActive && !isStrikeActive && !isSubscriptActive && !isSuperscriptActive && 'Regular'
                      ].filter(Boolean).join(', ')}
                    </span>
                  </div>
                  <div className="inspector-cell">
                    <span className="cell-label">Line Spacing</span>
                    <span className="cell-value font-mono">{activeLineSpacing}x</span>
                  </div>
                  {selectedPassage?.selectedText && (
                    <div className="inspector-cell" style={{ gridColumn: 'span 2', background: 'rgba(56, 189, 248, 0.08)', borderColor: 'rgba(56, 189, 248, 0.25)' }}>
                      <span className="cell-label" style={{ color: '#38BDF8' }}>Target Substring (Run/Span)</span>
                      <span className="cell-value font-mono" style={{ color: '#F8FAFC', fontWeight: 600 }}>
                        &ldquo;{selectedPassage.selectedText}&rdquo;
                      </span>
                    </div>
                  )}
                  {activeElement.metadata?.spans && activeElement.metadata.spans.length > 0 && (
                    <div className="inspector-cell" style={{ gridColumn: 'span 2', background: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.25)' }}>
                      <span className="cell-label" style={{ color: '#10B981' }}>Active Styled Spans ({activeElement.metadata.spans.length})</span>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                        {activeElement.metadata.spans.map((sp, idx) => (
                          <span key={idx} className="font-mono" style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: 2, background: 'rgba(0,0,0,0.3)', border: '1px solid #334155' }}>
                            &ldquo;{sp.text}&rdquo; &rarr; {JSON.stringify(sp.style)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="inspector-cell" style={{ gridColumn: 'span 2' }}>
                    <span className="cell-label">Spatial Coordinates (Points)</span>
                    <span className="cell-value font-mono" style={{ fontSize: '0.67rem' }}>
                      [{activeElement.bbox?.map((v) => Math.round(v)).join(', ')}] &bull; {Math.round((activeElement.bbox?.[2] || 0) - (activeElement.bbox?.[0] || 0))} &times; {Math.round((activeElement.bbox?.[3] || 0) - (activeElement.bbox?.[1] || 0))} pt
                    </span>
                  </div>
                </div>

                {/* Quick Action Prompt Chips */}
                <div className="inspector-quick-actions">
                  <span className="quick-actions-label">Quick Actions:</span>
                  <button
                    type="button"
                    className="inspector-chip-btn"
                    onClick={() => handleSendMessage(`Make ${activeElement.id} 22pt bold`)}
                    title="Run quick prompt: Make 22pt bold"
                  >
                    22pt Bold
                  </button>
                  <button
                    type="button"
                    className="inspector-chip-btn"
                    onClick={() => handleSendMessage(`Change ${activeElement.id} to left aligned`)}
                    title="Run quick prompt: Align Left"
                  >
                    Align Left
                  </button>
                  <button
                    type="button"
                    className="inspector-chip-btn"
                    onClick={() => handleSendMessage(`Change the color of ${activeElement.id} to #eab308`)}
                    title="Run quick prompt: Color Yellow"
                  >
                    Color Yellow
                  </button>
                </div>
              </div>
            )}

            {/* Messages Feed */}
            <div className="chat-messages-container">
              {messages.length === 0 ? (
                <div className="empty-chat-welcome">
                  <div className="welcome-icon-box">
                    <Sparkles size={22} />
                  </div>
                  <h3 className="welcome-title">Document Manipulation Studio</h3>
                  <p className="welcome-description">
                    Instruct the agent to reformat headings, tables, fonts, or colors.
                    Click any element on the document to target it precisely.
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`message-row message-row-${msg.role}`}>
                    {/* User Message */}
                    {msg.role === 'user' && (
                      <div className="user-message-bubble">
                        {msg.targetElement && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(2, 132, 199, 0.2)', border: '1px solid #0284C7', padding: '0.15rem 0.45rem', fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: '#38BDF8', marginBottom: '0.4rem' }}>
                            <MousePointer size={10} />
                            <span>Target: {msg.targetElement.type} ({msg.targetElement.id})</span>
                          </div>
                        )}
                        <p className="user-message-text" style={{ margin: 0 }}>{msg.text}</p>
                        <span className="message-timestamp" style={{ display: 'block', textAlign: 'right', fontSize: '0.65rem', opacity: 0.6, marginTop: '0.3rem' }}>
                          {msg.timestamp}
                        </span>
                      </div>
                    )}

                    {/* System Rollback Message */}
                    {msg.role === 'system' && (
                      <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(148, 163, 184, 0.08)', border: '1px dashed var(--border-color)', fontSize: '0.74rem', color: 'var(--text-dim)', margin: '0.25rem 0' }}>
                        <span>{msg.text}</span>
                      </div>
                    )}

                    {/* Assistant Message with Minimal Agent Execution Card */}
                    {msg.role === 'assistant' && (
                      <div className="assistant-message-bubble" style={{ width: '100%' }}>
                        {msg.checkpointId && msg.manipResult ? (
                          <div className={`checkpoint-card minimal-agent-card ${msg.decisionStatus ? `status-${msg.decisionStatus}` : ''}`}>
                            {/* Card Header Strip */}
                            <div className="checkpoint-header">
                              <div className="checkpoint-title-group">
                                <Bookmark size={12} className="checkpoint-bookmark-icon" />
                                <span>Checkpoint #{msg.checkpointId}</span>
                                {msg.decisionStatus === 'accepted' && (
                                  <span className="checkpoint-badge badge-accepted">
                                    <Check size={10} /> Accepted
                                  </span>
                                )}
                                {msg.decisionStatus === 'rejected' && (
                                  <span className="checkpoint-badge badge-rejected">
                                    <X size={10} /> Rejected
                                  </span>
                                )}
                                {(!msg.decisionStatus || msg.decisionStatus === 'pending') && (
                                  <span className="checkpoint-badge badge-pending">
                                    <Sparkles size={10} /> Modified
                                  </span>
                                )}
                              </div>
                              <span className="checkpoint-time">{msg.timestamp}</span>
                            </div>

                            {/* Minimal Body */}
                            <div className="checkpoint-body minimal-body">
                              <div className="minimal-summary-row">
                                <div className="minimal-action-text">
                                  <strong>{getMinimalActionSummary(msg.manipResult)}</strong>
                                  {msg.manipResult.target_element_id && (
                                    <span className="minimal-target-tag">
                                      {msg.manipResult.target_element_id} &bull; Page {(msg.manipResult.page_idx ?? 0) + 1}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Action Row: Accept / Reject / Compare / Details Dropdown */}
                              <div className="checkpoint-actions minimal-actions">
                                {(!msg.decisionStatus || msg.decisionStatus === 'pending') ? (
                                  <>
                                    <button
                                      type="button"
                                      className="checkpoint-accept-btn"
                                      onClick={() => handleAcceptMutation(msg.id)}
                                      title="Accept changes and remove highlight spotlight"
                                    >
                                      <Check size={12} />
                                      <span>Accept</span>
                                    </button>

                                    <button
                                      type="button"
                                      className="checkpoint-reject-btn"
                                      onClick={() => handleRejectMutation(msg.id)}
                                      title="Reject changes and rollback to previous checkpoint"
                                    >
                                      <X size={12} />
                                      <span>Reject</span>
                                    </button>
                                  </>
                                ) : msg.decisionStatus === 'accepted' ? (
                                  <div className="checkpoint-accepted-notice">
                                    <CheckCircle size={13} style={{ color: '#10B981' }} />
                                    <span>Accepted &bull; Spotlight Hidden</span>
                                  </div>
                                ) : (
                                  <div className="checkpoint-rejected-notice">
                                    <AlertTriangle size={13} style={{ color: '#EF4444' }} />
                                    <span>Rejected &bull; State Reverted</span>
                                  </div>
                                )}

                                <button
                                  type="button"
                                  className="checkpoint-compare-btn"
                                  onClick={() => {
                                    setLastMutationResult(msg.manipResult);
                                    setShowComparisonModal(true);
                                  }}
                                  title="View Before vs After region comparison"
                                >
                                  <Split size={11} />
                                  <span>Compare</span>
                                </button>

                                {msg.decisionStatus === 'accepted' && (
                                  <button
                                    type="button"
                                    className="checkpoint-revert-btn"
                                    onClick={handleUndo}
                                    title="Revert document state to this checkpoint"
                                  >
                                    <Undo2 size={11} />
                                    <span>Revert</span>
                                  </button>
                                )}

                                {/* Collapsible Details Toggle */}
                                <button
                                  type="button"
                                  className={`checkpoint-details-toggle ${expandedDetails[msg.id] ? 'active' : ''}`}
                                  onClick={() => toggleDetails(msg.id)}
                                  title="Toggle detailed execution delta & reasoning"
                                >
                                  <span>Details</span>
                                  {expandedDetails[msg.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                </button>
                              </div>

                              {/* Collapsible Details Dropdown */}
                              {expandedDetails[msg.id] && (
                                <div className="checkpoint-expanded-details">
                                  {/* Directive */}
                                  <div className="details-section">
                                    <div className="details-label">Natural Language Directive:</div>
                                    <div className="details-value font-mono">{msg.checkpointLabel || msg.text}</div>
                                  </div>

                                  {/* Reasoning */}
                                  {msg.manipResult.reasoning && (
                                    <div className="details-section">
                                      <div className="details-label">Cognitive Verification Trace:</div>
                                      <div className="details-value">{msg.manipResult.reasoning}</div>
                                    </div>
                                  )}

                                  {/* State Diff Table */}
                                  {msg.manipResult.state_diff && (
                                    <div className="details-section">
                                      <div className="details-label">Property State Delta:</div>
                                      <table className="state-diff-table">
                                        <thead>
                                          <tr>
                                            <th>Attribute</th>
                                            <th>Before</th>
                                            <th></th>
                                            <th>After</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {Object.entries(msg.manipResult.state_diff.after || {}).map(([prop, newVal]) => {
                                            const oldVal = msg.manipResult.state_diff.before?.[prop] ?? 'default';
                                            return (
                                              <tr key={prop}>
                                                <td style={{ color: 'var(--text-dim)' }}>{prop}</td>
                                                <td className="diff-val-old">{String(oldVal)}</td>
                                                <td className="diff-arrow">&rarr;</td>
                                                <td className="diff-val-new">{String(newVal)}</td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}

                                  {/* Technical Telemetry */}
                                  <div className="details-telemetry">
                                    <span>Decision: <strong style={{ color: '#10B981' }}>{msg.manipResult.decision || 'EXECUTE'}</strong></span>
                                    <span>Confidence: {Math.round((msg.manipResult.confidence || 0.95) * 100)}%</span>
                                    <span>Latency: {msg.manipResult.latency_ms || 12}ms</span>
                                    {msg.manipResult.target_bbox && (
                                      <span>BBox: [{msg.manipResult.target_bbox.map((v) => Math.round(v)).join(', ')}]</span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          /* Standard conversational message */
                          <div style={{ fontSize: '0.80rem', lineHeight: '1.45', color: 'var(--heading)' }}>
                            {msg.text}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}

              {isLoading && (
                <div className="message-row message-row-assistant">
                  <div className="assistant-message-bubble loading-bubble-modern" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 0.95rem' }}>
                    <Loader2 size={13} className="step-spinner" />
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>
                      Applying invertible mutation calculus &amp; re-rendering...
                    </span>
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>

            {/* Selected Target Element Indicator (Attached above input composer) */}
            {selectedPassage && (
              <div className="composer-passage-attachment" style={{ background: 'var(--bg-soft)', borderTop: '1px solid var(--border-color)', padding: '0.4rem 0.85rem' }}>
                <div className="attachment-left" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0, overflow: 'hidden' }}>
                  <MousePointer size={12} color="#0EA5E9" />
                  <span className="attachment-page-tag">Page {selectedPassage.pageIdx + 1}</span>
                  <span className="attachment-snippet" title={selectedPassage.text} style={{ fontSize: '0.74rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    &ldquo;{selectedPassage.text?.slice(0, 45)}...&rdquo;
                  </span>
                </div>
                <button
                  type="button"
                  className="attachment-clear-btn"
                  onClick={() => setSelectedPassage(null)}
                  title="Clear element target"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {/* Quick Preset Directive Chips */}
            <div style={{ display: 'flex', gap: '0.35rem', padding: '0.4rem 0.85rem', overflowX: 'auto', background: 'var(--panel)', borderTop: '1px solid var(--border-color)' }}>
              <button
                type="button"
                className="neo-btn"
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.68rem', whiteSpace: 'nowrap' }}
                onClick={() => setInputText('Make paper title 20pt bold and color #059669')}
              >
                Title &rarr; 20pt Bold Green
              </button>
              <button
                type="button"
                className="neo-btn"
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.68rem', whiteSpace: 'nowrap' }}
                onClick={() => setInputText('Format Abstract paragraph with 11pt italic')}
              >
                Abstract &rarr; 11pt Italic
              </button>
              <button
                type="button"
                className="neo-btn"
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.68rem', whiteSpace: 'nowrap' }}
                onClick={() => setInputText('Center align all author affiliations')}
              >
                Authors &rarr; Center Align
              </button>
            </div>

            {/* Prompt Composer */}
            <form
              className="chat-composer-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              style={{ padding: '0.65rem 0.85rem', background: 'var(--panel)', borderTop: '1px solid var(--border-color)' }}
            >
              <div className="composer-container" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <textarea
                  ref={textareaRef}
                  className="composer-textarea"
                  rows={2}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    selectedPassage
                      ? `Targeting element on Page ${selectedPassage.pageIdx + 1}. Enter instruction...`
                      : 'Enter instruction (e.g. Make heading 18pt bold and color #059669)...'
                  }
                  disabled={isLoading || !docSummary}
                  style={{ flex: 1 }}
                />

                <button
                  type="submit"
                  className="neo-btn-primary"
                  disabled={isLoading || !inputText.trim() || !docSummary}
                  style={{ padding: '0.6rem 0.85rem', height: '100%' }}
                >
                  {isLoading ? <Loader2 size={14} className="step-spinner" /> : <Send size={14} />}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* =========================================================================
          BEFORE / AFTER REGION COMPARISON MODAL
          ========================================================================= */}
      {showComparisonModal && lastMutationResult && (
        <div className="modal-overlay" onClick={() => setShowComparisonModal(false)}>
          <div className="comparison-modal-card neo-window" onClick={(e) => e.stopPropagation()}>
            <div className="neo-window-header">
              <div className="neo-window-dots">
                <span className="dot-red" />
                <span className="dot-yellow" />
                <span className="dot-green" />
              </div>
              <span className="neo-window-title font-mono">comparison.region // before_after</span>
            </div>

            <div className="modal-header" style={{ padding: '0.75rem 0.5rem 0 0.5rem' }}>
              <div>
                <h3 className="modal-title font-mono text-base font-bold" style={{ margin: 0 }}>
                  Before vs After Region Comparison
                </h3>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                  Target: <code>{lastMutationResult.target_element_id || 'Element'}</code> &bull; Page {(lastMutationResult.page_idx ?? 0) + 1}
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowComparisonModal(false)}
              >
                &times;
              </button>
            </div>

            {/* Inspection View: ONLYOFFICE Native Delta or Classic Side-by-side PIL */}
            {editorEngine === 'canvas' ? (
              <div className="comparison-split-grid">
                {/* Left: Original Before */}
                <div className="comparison-pane-card">
                  <div className="comparison-pane-header before">
                    <span>BEFORE (ORIGINAL)</span>
                    <span>Unmodified Baseline</span>
                  </div>
                  <div className="comparison-img-frame">
                    <img
                      src={lastMutationResult.before_image_url || origPages[lastMutationResult.page_idx ?? 0]?.image_url}
                      alt="Original Before"
                    />
                  </div>
                </div>

                {/* Right: Modified After */}
                <div className="comparison-pane-card">
                  <div className="comparison-pane-header after">
                    <span>AFTER (MODIFIED)</span>
                    <span>Applied &amp; Verified</span>
                  </div>
                  <div className="comparison-img-frame">
                    <img
                      src={lastMutationResult.re_rendered_image_url}
                      alt="Modified After"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ margin: '1rem 0', padding: '1rem', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.8rem' }}>
                  <Sparkles size={16} color="#38BDF8" />
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#F8FAFC' }}>
                    ONLYOFFICE Native Canvas Mutation
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '0.6rem' }}>
                  <strong>Mutation Directive:</strong> <code style={{ color: '#38BDF8' }}>{lastMutationResult.instruction || lastMutationResult.reasoning}</code>
                </div>
                {lastMutationResult.target_text && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '0.4rem' }}>
                    <strong>Target Passage:</strong> <span style={{ color: '#E2E8F0', fontStyle: 'italic' }}>&ldquo;{lastMutationResult.target_text}&rdquo;</span>
                  </div>
                )}
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                  State diff below represents atomic AST and formatting mutations synchronized to both ONLYOFFICE canvas and disk.
                </div>
              </div>
            )}

            {/* Property Mutation Diff Table */}
            {lastMutationResult.state_diff && (
              <div style={{ margin: '1rem 0' }}>
                <h4 className="font-mono text-xs font-bold" style={{ marginBottom: '0.4rem', color: 'var(--heading)' }}>
                  Applied Property State Delta:
                </h4>
                <table className="state-diff-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Property</th>
                      <th>Before Value</th>
                      <th></th>
                      <th>After Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(lastMutationResult.state_diff.after || {}).map(([prop, newVal]) => {
                      const oldVal = lastMutationResult.state_diff.before?.[prop] ?? 'default';
                      return (
                        <tr key={prop}>
                          <td style={{ color: 'var(--text-dim)' }}>{prop}</td>
                          <td className="diff-val-old">{String(oldVal)}</td>
                          <td className="diff-arrow">&rarr;</td>
                          <td className="diff-val-new">{String(newVal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                type="button"
                className="neo-btn"
                onClick={() => {
                  setShowComparisonModal(false);
                  handleUndo();
                }}
              >
                <Undo2 size={12} />
                <span>Revert This Edit</span>
              </button>
              <button
                type="button"
                className="neo-btn neo-btn-primary"
                onClick={() => setShowComparisonModal(false)}
              >
                <Check size={12} />
                <span>Keep Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          LIBRARY DOCUMENT PICKER MODAL
          ========================================================================= */}
      {showLibraryModal && (
        <div className="modal-overlay" onClick={() => setShowLibraryModal(false)}>
          <div className="modal-card neo-window" onClick={(e) => e.stopPropagation()}>
            <div className="neo-window-header">
              <div className="neo-window-dots">
                <span className="dot-red" />
                <span className="dot-yellow" />
                <span className="dot-green" />
              </div>
              <span className="neo-window-title font-mono">library.select_document</span>
            </div>

            <div className="modal-header" style={{ padding: '0.75rem 0.5rem 0 0.5rem' }}>
              <h3 className="modal-title font-mono text-base font-bold">Select Document from Library</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowLibraryModal(false)}
              >
                &times;
              </button>
            </div>

            <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', margin: '0.75rem 0' }}>
              {loadingDocs ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>
                  <Loader2 size={16} className="step-spinner" />
                  <span style={{ marginLeft: '0.5rem' }}>Loading documents...</span>
                </div>
              ) : libraryDocs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>
                  No documents found in library.
                </div>
              ) : (
                libraryDocs.map((doc) => (
                  <button
                    key={doc.document_id}
                    type="button"
                    className="neo-btn"
                    style={{ textAlign: 'left', width: '100%', justifyContent: 'space-between', padding: '0.65rem 0.85rem' }}
                    onClick={() => {
                      loadDocById(doc.document_id);
                      setShowLibraryModal(false);
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--heading)' }}>{doc.title || doc.filename}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                        {doc.page_count} pages &bull; {doc.file_type?.toUpperCase()} &bull; ID: {doc.document_id}
                      </div>
                    </div>
                    <ArrowRight size={13} />
                  </button>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
              <button
                type="button"
                className="neo-btn"
                onClick={() => setShowLibraryModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
