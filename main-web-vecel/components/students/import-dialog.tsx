"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Download, FileSpreadsheet, KeyRound, Loader2, Mail, UploadCloud, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import type { Batch, ImportResult, StudentCreateResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Segmented, StatusPill } from "@/components/app/kit";
import { BatchPicker, EMAIL_RE, downloadText, parseCsv, toCsv } from "./shared";

type Mode = "password" | "invite";
interface Row {
  name: string;
  email: string;
  error?: string;
}

const MAX_ROWS = 200;

/** Turn raw CSV cells into {name,email} rows, detecting a header row and column positions. */
function toRows(cells: string[][]): Row[] {
  if (!cells.length) return [];
  const header = cells[0].map((h) => h.toLowerCase());
  const hasHeader = header.some((h) => /mail/.test(h)) || header.some((h) => /name/.test(h));
  let emailCol = header.findIndex((h) => /mail/.test(h));
  let nameCol = header.findIndex((h) => /^(full ?name|name|student)/.test(h));
  const firstCol = header.findIndex((h) => /first/.test(h));
  const lastCol = header.findIndex((h) => /last|surname/.test(h));
  const body = hasHeader ? cells.slice(1) : cells;
  if (emailCol < 0) {
    // No header: pick the column that looks like emails.
    emailCol = Math.max(0, (body[0] || []).findIndex((c) => EMAIL_RE.test(c)));
  }
  if (nameCol < 0 && firstCol < 0) nameCol = emailCol === 0 ? 1 : 0;

  const seen = new Set<string>();
  return body.map((r) => {
    const email = (r[emailCol] || "").trim().toLowerCase();
    const name =
      firstCol >= 0 ? [r[firstCol], lastCol >= 0 ? r[lastCol] : ""].filter(Boolean).join(" ").trim() : (r[nameCol] || "").trim();
    let error: string | undefined;
    if (!EMAIL_RE.test(email)) error = "Invalid email";
    else if (!name) error = "Missing name";
    else if (seen.has(email)) error = "Duplicate";
    seen.add(email);
    return { name: name || email.split("@")[0] || "", email, error };
  });
}

export function ImportDialog({
  open,
  onOpenChange,
  batches,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batches: Batch[];
  onImported: () => void;
}) {
  const api = useApi();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [mode, setMode] = useState<Mode>("password");
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    if (open) {
      setFileName(null);
      setRows([]);
      setMode("password");
      setBatchIds([]);
      setResult(null);
    }
  }, [open]);

  const valid = useMemo(() => rows.filter((r) => !r.error), [rows]);

  async function readFile(file: File) {
    if (!/\.(csv|txt|tsv)$/i.test(file.name) && !file.type.includes("csv") && !file.type.startsWith("text/")) {
      toast.error("Please choose a .csv file");
      return;
    }
    const parsed = toRows(parseCsv(await file.text()));
    if (!parsed.length) {
      toast.error("That file has no rows");
      return;
    }
    if (parsed.length > MAX_ROWS) toast.warning(`Only the first ${MAX_ROWS} rows will be imported`);
    setFileName(file.name);
    setRows(parsed.slice(0, MAX_ROWS));
  }

  async function submit() {
    if (!valid.length) return;
    setBusy(true);
    try {
      const r = await api<ImportResult>("/api/students/import", {
        method: "POST",
        json: { rows: valid.map(({ name, email }) => ({ name, email })), mode, batch_ids: batchIds },
      });
      setResult(r);
      onImported();
      toast.success(`Imported ${r.created + r.invited + r.linked} of ${valid.length} students`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function downloadCredentials(created: StudentCreateResult[]) {
    downloadText(
      toCsv([["Name", "Email", "Temporary password"], ...created.map((c) => [c.name, c.email, c.password])]),
      "guard-ai-student-credentials.csv"
    );
  }

  function downloadTemplate() {
    downloadText(toCsv([["name", "email"], ["Aarav Sharma", "aarav@college.edu"], ["Diya Patel", "diya@college.edu"]]), "students-template.csv");
  }

  const created = result?.results.filter((r) => r.status === "created" && r.password) ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <p className="eyebrow">Bulk import</p>
          <DialogTitle className="text-xl tracking-tight">{result ? "Import complete" : "Import students from CSV"}</DialogTitle>
          <DialogDescription>
            {result
              ? `${result.created} created · ${result.invited} invited · ${result.linked} linked · ${result.failed} failed`
              : "One student per row with a name and an email column. Up to 200 rows per import."}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            {created.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-warning/10 px-4 py-3 text-sm text-warning">
                <span>Download the credentials now — passwords are shown only once.</span>
                <Button size="sm" onClick={() => downloadCredentials(created)}>
                  <Download /> Credentials CSV
                </Button>
              </div>
            )}
            <div className="max-h-[340px] overflow-auto rounded-2xl border border-border/70">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border/70">
                  {result.results.map((r, i) => (
                    <tr key={`${r.email}-${i}`}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{r.name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{r.email}</p>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {r.status === "error" || r.status === "skipped" ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
                            <XCircle className="h-3.5 w-3.5" /> {r.error || r.status}
                          </span>
                        ) : (
                          <StatusPill status={r.status === "created" ? "submitted" : r.status} label={r.status} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-5">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) readFile(f);
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-[24px] border-2 border-dashed p-8 text-center transition-colors",
                dragging ? "border-foreground/40 bg-muted" : "border-border"
              )}
            >
              <span className="grainient-soft flex h-12 w-12 items-center justify-center rounded-full">
                {fileName ? <FileSpreadsheet className="relative z-10 h-5 w-5" /> : <UploadCloud className="relative z-10 h-5 w-5" />}
              </span>
              <p className="text-sm font-medium">{fileName ?? "Drop a CSV here"}</p>
              <p className="text-xs text-muted-foreground">
                {fileName ? `${rows.length} rows · ${valid.length} valid` : "Columns: name, email (first/last name also work)"}
              </p>
              <div className="mt-1 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
                  {fileName ? "Choose another" : "Choose file"}
                </Button>
                {!fileName && (
                  <Button size="sm" variant="ghost" onClick={downloadTemplate}>
                    <Download /> Template
                  </Button>
                )}
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) readFile(f);
                  e.target.value = "";
                }}
              />
            </div>

            {rows.length > 0 && (
              <div className="max-h-[220px] overflow-auto rounded-2xl border border-border/70">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
                    <tr className="border-b border-border/70">
                      <th className="px-4 py-2 font-medium">Name</th>
                      <th className="px-4 py-2 font-medium">Email</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {rows.map((r, i) => (
                      <tr key={i} className={cn(r.error && "bg-destructive/5")}>
                        <td className="px-4 py-2">{r.name || "—"}</td>
                        <td className="px-4 py-2 text-muted-foreground">{r.email || "—"}</td>
                        <td className="px-4 py-2 text-right">
                          {r.error ? (
                            <span className="text-xs text-destructive">{r.error}</span>
                          ) : (
                            <CheckCircle2 className="ml-auto h-4 w-4 text-success" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Field label="How should they get access?">
              <Segmented<Mode>
                value={mode}
                onChange={setMode}
                className="w-full [&>button]:flex-1 [&>button]:justify-center"
                options={[
                  { value: "password", label: (<><KeyRound className="h-4 w-4" /> Create accounts</>) },
                  { value: "invite", label: (<><Mail className="h-4 w-4" /> Email invites</>) },
                ]}
              />
            </Field>
            <Field label="Add everyone to batches">
              <BatchPicker batches={batches} value={batchIds} onChange={setBatchIds} />
            </Field>

            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={busy || !valid.length}>
                {busy && <Loader2 className="animate-spin" />}
                Import {valid.length || ""} student{valid.length === 1 ? "" : "s"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
