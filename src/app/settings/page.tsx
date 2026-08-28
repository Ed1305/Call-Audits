"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GnomeWindow } from "@/components/ui/GnomeWindow";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { useTheme } from "@/components/theme/ThemeProvider";
import { showToast } from "@/components/ui/Toast";
import type { CampaignScorecard, RubricCriterion } from "@/lib/db/schema";

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const [llmProvider, setLlmProvider] = useState("gemini");
  const [openaiKey, setOpenaiKey] = useState("");
  const [openaiModel, setOpenaiModel] = useState("gpt-4o-mini");
  const [geminiModel, setGeminiModel] = useState("gemini-3.6-flash");
  const [ollamaModel, setOllamaModel] = useState("llama3.2");
  const [whisperModel, setWhisperModel] = useState("base");
  const [passThreshold, setPassThreshold] = useState("70");

  const handleSave = () => {
    showToast(
      "Settings saved locally (configure .env for server-side changes)",
      "success"
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="font-ubuntu text-2xl font-bold">Settings</h1>
        <p className="font-ubuntu text-sm text-gray-500 mt-1">
          Configure CallAudit AI preferences
        </p>
      </div>

      <GnomeWindow title="Appearance">
        <Toggle
          checked={theme === "dark"}
          onChange={() => toggleTheme()}
          label={
            theme === "dark"
              ? "Dark Mode (Yaru Dark)"
              : "Light Mode (Yaru Light)"
          }
        />
      </GnomeWindow>

      <GnomeWindow title="LLM Provider">
        <div className="space-y-4">
          <Select
            label="Provider"
            value={llmProvider}
            onChange={(e) => setLlmProvider(e.target.value)}
            options={[
              {
                value: "gemini",
                label: "Gemini (listens to the call — recommended)",
              },
              { value: "openai", label: "OpenAI API (transcript)" },
              { value: "ollama", label: "Ollama (Local transcript)" },
              { value: "compatible", label: "OpenAI-Compatible Endpoint" },
            ]}
          />

          {llmProvider === "gemini" && (
            <>
              <Input
                label="Gemini Model"
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
              />
              <p className="font-ubuntu text-xs text-gray-500">
                Set GEMINI_API_KEY and LLM_PROVIDER=gemini in .env. With
                LISTEN_MODE=audio, Gemini first listens (notes only), then a
                second text pass scores against your campaign scorecard.
              </p>
            </>
          )}

          {(llmProvider === "openai" || llmProvider === "compatible") && (
            <>
              <Input
                label="API Key"
                type="password"
                placeholder="sk-..."
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
              />
              <Input
                label="Model"
                value={openaiModel}
                onChange={(e) => setOpenaiModel(e.target.value)}
              />
              <p className="font-ubuntu text-xs text-gray-500">
                Set OPENAI_API_KEY and OPENAI_MODEL in your .env file for
                server-side configuration.
              </p>
            </>
          )}

          {llmProvider === "ollama" && (
            <>
              <Input
                label="Ollama Model"
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
              />
              <p className="font-ubuntu text-xs text-gray-500">
                Ensure Ollama is running at localhost:11434. Set OLLAMA_MODEL
                in .env.
              </p>
            </>
          )}
        </div>
      </GnomeWindow>

      <GnomeWindow title="Audio Processing">
        <div className="space-y-4">
          <Select
            label="Whisper Model Size"
            value={whisperModel}
            onChange={(e) => setWhisperModel(e.target.value)}
            options={[
              { value: "tiny", label: "Tiny (fastest, least accurate)" },
              { value: "base", label: "Base (recommended)" },
              { value: "small", label: "Small" },
              { value: "medium", label: "Medium" },
              { value: "large-v3", label: "Large v3 (most accurate)" },
            ]}
          />
          <p className="font-ubuntu text-xs text-gray-500">
            Requires Python with faster-whisper installed. Set WHISPER_MODEL in
            .env. Used when LISTEN_MODE=transcript.
          </p>
        </div>
      </GnomeWindow>

      <GnomeWindow title="QA Scoring">
        <Input
          label="Pass Threshold (%)"
          type="number"
          min="0"
          max="100"
          value={passThreshold}
          onChange={(e) => setPassThreshold(e.target.value)}
        />
        <p className="font-ubuntu text-xs text-gray-500 mt-2">
          Calls scoring below this threshold will be marked as fail.
        </p>
      </GnomeWindow>

      <ScorecardsSection />

      <div className="flex justify-end">
        <Button onClick={handleSave}>Save Settings</Button>
      </div>
    </div>
  );
}

function ScorecardsSection() {
  const [cards, setCards] = useState<CampaignScorecard[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<CampaignScorecard | null>(null);
  const [saving, setSaving] = useState(false);
  const [phraseDraft, setPhraseDraft] = useState("");
  const [claimDraft, setClaimDraft] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/scorecards");
    if (!res.ok) {
      showToast("Failed to load scorecards", "error");
      return;
    }
    const data = (await res.json()) as CampaignScorecard[];
    setCards(data);
    setSelectedId((prev) => {
      if (prev && data.some((c) => c.id === prev)) return prev;
      const def = data.find((c) => c.isDefault) || data[0];
      return def?.id || "";
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const card = cards.find((c) => c.id === selectedId) || null;
    setDraft(card ? structuredClone(card) : null);
  }, [cards, selectedId]);

  const maxSum = useMemo(
    () => (draft?.criteria || []).reduce((s, c) => s + (Number(c.max) || 0), 0),
    [draft]
  );

  const save = async () => {
    if (!draft) return;
    if (maxSum !== 100) {
      showToast(
        `Criteria max values must sum to 100 (currently ${maxSum})`,
        "error"
      );
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/scorecards/${draft.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Save failed");
      showToast("Scorecard saved", "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const createCard = async () => {
    const template = draft || cards[0];
    try {
      const res = await fetch("/api/scorecards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New campaign scorecard",
          scriptText: "",
          mandatoryPhrases: [],
          prohibitedClaims: [],
          criteria: template?.criteria || [],
          dispositionCodes: template?.dispositionCodes || [],
          isDefault: false,
        }),
      });
      const data = (await res.json()) as CampaignScorecard & { error?: string };
      if (!res.ok) throw new Error(data.error || "Create failed");
      showToast("Scorecard created", "success");
      await load();
      setSelectedId(data.id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Create failed", "error");
    }
  };

  const deleteCard = async () => {
    if (!draft) return;
    if (!window.confirm(`Delete “${draft.name}”?`)) return;
    try {
      const res = await fetch(`/api/scorecards/${draft.id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Delete failed");
      showToast("Scorecard deleted", "success");
      setSelectedId("");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  };

  const markDefault = async () => {
    if (!draft) return;
    try {
      const res = await fetch(`/api/scorecards/${draft.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, isDefault: true }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Update failed");
      showToast("Default scorecard updated", "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Update failed", "error");
    }
  };

  const updateCriterion = (index: number, patch: Partial<RubricCriterion>) => {
    if (!draft) return;
    const criteria = draft.criteria.map((c, i) =>
      i === index ? { ...c, ...patch } : c
    );
    setDraft({ ...draft, criteria });
  };

  const updateAnchor = (
    index: number,
    key: "excellent" | "adequate" | "poor",
    value: string
  ) => {
    if (!draft) return;
    const criteria = draft.criteria.map((c, i) =>
      i === index
        ? { ...c, anchors: { ...c.anchors, [key]: value } }
        : c
    );
    setDraft({ ...draft, criteria });
  };

  return (
    <GnomeWindow title="Scorecards">
      <div className="space-y-5">
        <p className="font-ubuntu text-xs text-gray-500">
          Campaign QA forms. The selected default is used on upload unless you
          pick another. Criteria max values must sum to 100.
        </p>

        <div className="flex flex-wrap gap-2">
          <div className="flex-1 min-w-[200px]">
            <Select
              label="Scorecard"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              options={
                cards.length
                  ? cards.map((c) => ({
                      value: c.id,
                      label: c.isDefault ? `${c.name} (default)` : c.name,
                    }))
                  : [{ value: "", label: "No scorecards yet" }]
              }
            />
          </div>
          <div className="flex items-end gap-2">
            <Button variant="secondary" size="sm" onClick={createCard}>
              New
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={markDefault}
              disabled={!draft || draft.isDefault}
            >
              Make default
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={deleteCard}
              disabled={!draft || cards.length <= 1}
            >
              Delete
            </Button>
          </div>
        </div>

        {draft && (
          <>
            <Input
              label="Name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <Textarea
              label="Campaign script"
              className="min-h-[160px] font-ubuntu-mono"
              placeholder="Paste the actual campaign script here"
              value={draft.scriptText}
              onChange={(e) =>
                setDraft({ ...draft, scriptText: e.target.value })
              }
            />

            <StringListEditor
              label="Mandatory phrases"
              values={draft.mandatoryPhrases}
              draft={phraseDraft}
              onDraftChange={setPhraseDraft}
              onChange={(mandatoryPhrases) =>
                setDraft({ ...draft, mandatoryPhrases })
              }
            />
            <StringListEditor
              label="Prohibited claims"
              values={draft.prohibitedClaims}
              draft={claimDraft}
              onDraftChange={setClaimDraft}
              onChange={(prohibitedClaims) =>
                setDraft({ ...draft, prohibitedClaims })
              }
            />

            <div>
              <div className="flex justify-between items-baseline mb-2">
                <p className="font-ubuntu text-sm font-medium">Criteria</p>
                <p
                  className={`font-ubuntu-mono text-xs ${
                    maxSum === 100 ? "text-ubuntu-maximize" : "text-ubuntu-close"
                  }`}
                >
                  Max sum: {maxSum} / 100
                </p>
              </div>
              <div className="space-y-4">
                {draft.criteria.map((c, i) => (
                  <div
                    key={c.key}
                    className="p-3 rounded-gnome-sm border border-ubuntu-border-light dark:border-ubuntu-border-dark space-y-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Input
                        label="Label"
                        value={c.label}
                        onChange={(e) =>
                          updateCriterion(i, { label: e.target.value })
                        }
                      />
                      <Input
                        label="Key"
                        value={c.key}
                        onChange={(e) =>
                          updateCriterion(i, { key: e.target.value })
                        }
                      />
                      <Input
                        label="Max"
                        type="number"
                        min={0}
                        value={String(c.max)}
                        onChange={(e) =>
                          updateCriterion(i, {
                            max: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <Textarea
                      label="What this covers"
                      value={c.description}
                      onChange={(e) =>
                        updateCriterion(i, { description: e.target.value })
                      }
                    />
                    <Textarea
                      label="Full marks sounds like"
                      value={c.anchors.excellent}
                      onChange={(e) =>
                        updateAnchor(i, "excellent", e.target.value)
                      }
                    />
                    <Textarea
                      label="Mid sounds like"
                      value={c.anchors.adequate}
                      onChange={(e) =>
                        updateAnchor(i, "adequate", e.target.value)
                      }
                    />
                    <Textarea
                      label="Low sounds like"
                      value={c.anchors.poor}
                      onChange={(e) => updateAnchor(i, "poor", e.target.value)}
                    />
                    <Input
                      label="Auto-fail if (optional)"
                      value={c.autoFailIf || ""}
                      onChange={(e) =>
                        updateCriterion(i, {
                          autoFailIf: e.target.value || undefined,
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving..." : "Save scorecard"}
              </Button>
            </div>
          </>
        )}
      </div>
    </GnomeWindow>
  );
}

function StringListEditor({
  label,
  values,
  draft,
  onDraftChange,
  onChange,
}: {
  label: string;
  values: string[];
  draft: string;
  onDraftChange: (value: string) => void;
  onChange: (values: string[]) => void;
}) {
  const add = () => {
    const next = draft.trim();
    if (!next) return;
    if (values.includes(next)) {
      showToast("Already in the list", "info");
      return;
    }
    onChange([...values, next]);
    onDraftChange("");
  };

  return (
    <div className="space-y-2">
      <p className="font-ubuntu text-sm font-medium">{label}</p>
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            value={draft}
            placeholder="Add a line, then press Add"
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
        </div>
        <div className="flex items-end">
          <Button variant="secondary" size="sm" type="button" onClick={add}>
            Add
          </Button>
        </div>
      </div>
      {values.length > 0 && (
        <ul className="space-y-1">
          {values.map((item) => (
            <li
              key={item}
              className="flex items-center justify-between gap-2 px-2 py-1 rounded-gnome-sm bg-black/5 dark:bg-white/5"
            >
              <span className="font-ubuntu text-sm">{item}</span>
              <button
                type="button"
                className="font-ubuntu text-xs text-ubuntu-close hover:underline"
                onClick={() => onChange(values.filter((v) => v !== item))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
