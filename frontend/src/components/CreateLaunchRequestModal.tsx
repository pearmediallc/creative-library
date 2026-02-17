import React, { useState, useEffect } from 'react';
import { X, FileText, ChevronDown, ChevronUp, Save } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { MultiSelect } from './ui/MultiSelect';
import { launchRequestApi, editorApi, authApi } from '../lib/api';
import { FILE_REQUEST_TYPES } from '../constants/fileRequestTypes';
import { PLATFORMS } from '../constants/platforms';
import { VERTICALS } from '../constants/verticals';
import { CanvasEditor } from './CanvasEditor';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

interface Editor {
  id: string;
  name: string;
  display_name?: string;
}

interface Buyer {
  id: string;
  name: string;
  email: string;
}

interface LRTemplate {
  id: string;
  name: string;
  default_request_type?: string;
  default_platforms?: string[];
  default_verticals?: string[];
  default_num_creatives?: number;
  default_suggested_run_qty?: number;
  default_concept_notes?: string;
  default_notes_to_creative?: string;
  default_notes_to_buyer?: string;
}

export function CreateLaunchRequestModal({ onClose, onSuccess }: Props) {
  // ── form state ────────────────────────────────────────────────────────────
  const [requestType, setRequestType] = useState('');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [verticals, setVerticals] = useState<string[]>([]);
  const [conceptNotes, setConceptNotes] = useState('');
  const [numCreatives, setNumCreatives] = useState('');
  const [suggestedRunQty, setSuggestedRunQty] = useState('');
  const [deliveryDeadline, setDeliveryDeadline] = useState('');
  const [testDeadline, setTestDeadline] = useState('');
  const [notesToCreative, setNotesToCreative] = useState('');
  const [notesToBuyer, setNotesToBuyer] = useState('');

  const [creativeHeadId, setCreativeHeadId] = useState('');
  const [buyerHeadId, setBuyerHeadId] = useState('');
  const [selectedEditorIds, setSelectedEditorIds] = useState<string[]>([]);
  const [selectedBuyerIds, setSelectedBuyerIds] = useState<string[]>([]);

  // ── template state ────────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<LRTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // ── canvas ────────────────────────────────────────────────────────────────
  const [showCanvas, setShowCanvas] = useState(false);
  const [createdRequestId, setCreatedRequestId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ── data ──────────────────────────────────────────────────────────────────
  const [editors, setEditors] = useState<Editor[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);           // for Assign Buyer Head dropdown
  const [creativeUsers, setCreativeUsers] = useState<Buyer[]>([]); // for Assign Creative Head dropdown

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // ── fetch data ────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [editorsRes, buyersRes, creativeUsersRes, templatesRes] = await Promise.all([
          editorApi.getAll(),
          authApi.getBuyers(),
          authApi.getUsersByRole('creative'),
          launchRequestApi.getTemplates().catch(() => ({ data: { data: [] } }))
        ]);

        const editorsData = editorsRes.data.data || [];
        setEditors(editorsData.map((e: any) => ({
          id: e.id,
          name: e.display_name || e.name,
          display_name: e.display_name
        })));

        // Buyer Head: buyers + admins (who manage the buyer side)
        const buyersData = buyersRes.data.data || buyersRes.data || [];
        setBuyers(buyersData);

        // Creative Head: users with creative role
        const creativeData = creativeUsersRes.data.data || creativeUsersRes.data || [];
        setCreativeUsers(creativeData);

        setTemplates(templatesRes.data.data || []);
      } catch (err) {
        console.error('Failed to load form data:', err);
      }
    };
    load();
  }, []);

  // ── apply template ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedTemplateId) return;
    const tpl = templates.find(t => t.id === selectedTemplateId);
    if (!tpl) return;

    if (tpl.default_request_type) setRequestType(tpl.default_request_type);
    if (tpl.default_platforms?.length) setPlatforms(tpl.default_platforms);
    if (tpl.default_verticals?.length) setVerticals(tpl.default_verticals);
    if (tpl.default_num_creatives) setNumCreatives(String(tpl.default_num_creatives));
    if (tpl.default_suggested_run_qty) setSuggestedRunQty(String(tpl.default_suggested_run_qty));
    if (tpl.default_concept_notes) setConceptNotes(tpl.default_concept_notes);
    if (tpl.default_notes_to_creative) setNotesToCreative(tpl.default_notes_to_creative);
    if (tpl.default_notes_to_buyer) setNotesToBuyer(tpl.default_notes_to_buyer);
  }, [selectedTemplateId, templates]);

  // ── validation ────────────────────────────────────────────────────────────
  const validate = () => {
    if (!requestType) return 'Request type is required';
    if (platforms.length === 0) return 'At least one platform is required';
    if (verticals.length === 0) return 'At least one vertical is required';
    if (!numCreatives || Number(numCreatives) < 1) return 'Number of creatives must be at least 1';
    return null;
  };

  // ── submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (asDraft = false) => {
    setError('');
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setCreating(true);
    try {
      const payload: any = {
        request_type: requestType,
        platforms,
        verticals,
        concept_notes: conceptNotes,
        num_creatives: Number(numCreatives),
        suggested_run_qty: suggestedRunQty ? Number(suggestedRunQty) : undefined,
        delivery_deadline: deliveryDeadline || undefined,
        test_deadline: testDeadline || undefined,
        notes_to_creative: notesToCreative || undefined,
        notes_to_buyer: notesToBuyer || undefined,
        creative_head_id: creativeHeadId || undefined,
        buyer_head_id: buyerHeadId || undefined,
        editor_ids: selectedEditorIds.length > 0 ? selectedEditorIds : undefined,
        buyer_ids: selectedBuyerIds.length > 0 ? selectedBuyerIds : undefined,
        status: asDraft ? 'draft' : 'pending_review',
        save_as_template: saveAsTemplate,
        template_name: saveAsTemplate ? templateName : undefined,
      };

      const response = await launchRequestApi.create(payload);
      const newRequest = response.data.data;
      setCreatedRequestId(newRequest.id);
      setSuccess(true);

      if (!asDraft && showCanvas) {
        // Auto-open canvas with pre-populated content
        // Canvas open handled below via showCanvas state
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create launch request');
    } finally {
      setCreating(false);
    }
  };

  // ── canvas pre-fill content ───────────────────────────────────────────────
  const canvasPreFillContent = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Launch Brief' }] },
      { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Request Type: ' }, { type: 'text', text: requestType }] },
      { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Platform(s): ' }, { type: 'text', text: platforms.join(', ') }] },
      { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Vertical(s): ' }, { type: 'text', text: verticals.join(', ') }] },
      { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Creatives to produce: ' }, { type: 'text', text: numCreatives }] },
      ...(suggestedRunQty ? [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Suggested run quantity: ' }, { type: 'text', text: suggestedRunQty }] }] : []),
      ...(deliveryDeadline ? [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Delivery deadline: ' }, { type: 'text', text: new Date(deliveryDeadline).toLocaleDateString() }] }] : []),
      ...(testDeadline ? [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Test deadline: ' }, { type: 'text', text: new Date(testDeadline).toLocaleDateString() }] }] : []),
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Concept Notes' }] },
      { type: 'paragraph', content: [{ type: 'text', text: conceptNotes || '(Add your concept notes here)' }] },
      ...(notesToCreative ? [
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Notes to Creative Team' }] },
        { type: 'paragraph', content: [{ type: 'text', text: notesToCreative }] }
      ] : []),
      ...(notesToBuyer ? [
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Notes to Buyer Team' }] },
        { type: 'paragraph', content: [{ type: 'text', text: notesToBuyer }] }
      ] : []),
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Reference Creatives' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '(Attach reference creatives below)' }] }
    ]
  };

  // ── canvas open after create ──────────────────────────────────────────────
  if (showCanvas && createdRequestId) {
    return (
      <CanvasEditor
        requestId={createdRequestId}
        onClose={() => {
          setShowCanvas(false);
          onSuccess();
          onClose();
        }}
      />
    );
  }

  // ── success screen ────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-background rounded-xl shadow-xl w-full max-w-md p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <FileText className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold">Launch Request Created!</h2>
          <p className="text-muted-foreground text-sm">
            Your launch request has been submitted and will be reviewed by the creative and buyer heads.
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <Button variant="outline" onClick={() => { onSuccess(); onClose(); }}>
              Done
            </Button>
            <Button
              onClick={() => setShowCanvas(true)}
            >
              <FileText className="w-4 h-4 mr-2" />
              Open Canvas Brief
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── main form ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b shrink-0">
          <div>
            <h2 className="text-lg font-semibold">New Launch Request</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Suggest creatives for media buyers to test</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Template picker */}
          {templates.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Use Template</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedTemplateId}
                onChange={e => setSelectedTemplateId(e.target.value)}
              >
                <option value="">— No template —</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Request Type */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Request Type <span className="text-destructive">*</span>
            </label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={requestType}
              onChange={e => setRequestType(e.target.value)}
            >
              <option value="">Select type...</option>
              {FILE_REQUEST_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Platforms */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Platform(s) <span className="text-destructive">*</span>
            </label>
            <MultiSelect
              options={PLATFORMS.map(p => ({ id: p, label: p }))}
              selectedIds={platforms}
              onChange={setPlatforms}
              placeholder="Select platforms..."
            />
          </div>

          {/* Verticals */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Vertical(s) <span className="text-destructive">*</span>
            </label>
            <MultiSelect
              options={VERTICALS.map(v => ({ id: v, label: v }))}
              selectedIds={verticals}
              onChange={setVerticals}
              placeholder="Select verticals..."
            />
          </div>

          {/* Concept Notes */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Concept Notes / Brief</label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              rows={3}
              placeholder="Describe the creative concept, angles, references..."
              value={conceptNotes}
              onChange={e => setConceptNotes(e.target.value)}
            />
          </div>

          {/* Creatives to produce + Suggested run qty */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                No. of Creatives <span className="text-destructive">*</span>
              </label>
              <Input
                type="number"
                min={1}
                placeholder="e.g. 10"
                value={numCreatives}
                onChange={e => setNumCreatives(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Suggested Run Qty</label>
              <Input
                type="number"
                min={1}
                placeholder="e.g. 5"
                value={suggestedRunQty}
                onChange={e => setSuggestedRunQty(e.target.value)}
              />
            </div>
          </div>

          {/* Deadlines */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Delivery Deadline</label>
              <Input
                type="datetime-local"
                value={deliveryDeadline}
                onChange={e => setDeliveryDeadline(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Test Deadline (Buyer)</label>
              <Input
                type="datetime-local"
                value={testDeadline}
                onChange={e => setTestDeadline(e.target.value)}
              />
            </div>
          </div>

          {/* Assign Heads */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Assign Creative Head</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={creativeHeadId}
                onChange={e => setCreativeHeadId(e.target.value)}
              >
                <option value="">— Select creative head —</option>
                {creativeUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Assign Buyer Head</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={buyerHeadId}
                onChange={e => setBuyerHeadId(e.target.value)}
              >
                <option value="">— Select buyer head —</option>
                {buyers.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Advanced section toggle */}
          <button
            type="button"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full py-1"
            onClick={() => setShowAdvanced(v => !v)}
          >
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showAdvanced ? 'Hide' : 'Show'} advanced options
          </button>

          {showAdvanced && (
            <div className="space-y-5 border-t pt-4">

              {/* Assign Editors */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Assign Editors (Creative Side)</label>
                <MultiSelect
                  options={editors.map(e => ({ id: e.id, label: e.name }))}
                  selectedIds={selectedEditorIds}
                  onChange={setSelectedEditorIds}
                  placeholder="Select editors..."
                />
              </div>

              {/* Assign Media Buyers */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Assign Media Buyers</label>
                <MultiSelect
                  options={buyers.map(b => ({ id: b.id, label: `${b.name} (${b.email})` }))}
                  selectedIds={selectedBuyerIds}
                  onChange={setSelectedBuyerIds}
                  placeholder="Select buyers..."
                />
              </div>

              {/* Notes to Creative */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Notes to Creative Head</label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                  rows={2}
                  placeholder="Internal notes for the creative team..."
                  value={notesToCreative}
                  onChange={e => setNotesToCreative(e.target.value)}
                />
              </div>

              {/* Notes to Buyer */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Notes to Buyer Head</label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                  rows={2}
                  placeholder="Internal notes for the buyer team..."
                  value={notesToBuyer}
                  onChange={e => setNotesToBuyer(e.target.value)}
                />
              </div>

              {/* Canvas brief toggle */}
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <input
                  type="checkbox"
                  id="create-canvas"
                  checked={showCanvas}
                  onChange={e => setShowCanvas(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="create-canvas" className="text-sm">
                  Open Canvas Brief after creating (pre-filled with form data)
                </label>
              </div>
            </div>
          )}

          {/* Save as template */}
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="save-template"
                checked={saveAsTemplate}
                onChange={e => setSaveAsTemplate(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="save-template" className="text-sm flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" />
                Save as template
              </label>
            </div>
            {saveAsTemplate && (
              <Input
                placeholder="Template name..."
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
              />
            )}
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t shrink-0">
          <Button variant="outline" onClick={() => handleSubmit(true)} disabled={creating}>
            Save as Draft
          </Button>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={() => handleSubmit(false)} disabled={creating}>
              {creating ? 'Submitting...' : 'Submit for Review'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
