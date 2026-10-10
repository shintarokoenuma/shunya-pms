"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  decideMaterialHs,
  getMaterialHsContext,
  type MaterialHsContext,
} from "@/lib/actions/material-hs";
import type { HsReferenceMaterial } from "@/lib/actions/materials";
import {
  EXPORT_SPEC_FIELDS,
  compositionTotal,
  formatComposition,
  summarizeExportSpec,
  type ExportSpecInput,
  type HsSource,
} from "@/lib/hs/export-spec";
import {
  candidateNote,
  classifyHs,
  displayHsCandidate,
  type HsResult,
} from "@/lib/hs/classify";
import { buildCopyFromReference } from "@/lib/hs/copy-from-reference";
import {
  HS_QUESTION_LABELS,
  hsQuestionKind,
  hsQuestionOptions,
  nextHsQuestion,
  type HsQuestionKey,
} from "@/lib/hs/questions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CompositionRows,
  toCompositionData,
  type CompositionRowInput,
} from "../../materials/_components/composition-rows";
import { ReferenceMaterials } from "../../materials/_components/reference-materials";
import { MATERIAL_TYPE_LABELS } from "../../materials/_components/labels";

/**
 * B-211 PR-2（P2-D3・案B＋最初に案C）: 発注の明細の「HS を決める」ダイアログ
 * 上から: 似た材料（案C）→ 質問（1 問ずつ・missing の先頭）→ 右に候補 → 「この HS で確定」／「手で入力」
 * - 確定は decideMaterialHs（材料に保存。編集できない役割なら行にだけ）→ onDecided で発注のフォームの行に入れる
 * - 発注の保存はフォームの「保存」（ここではフォームの値を書き換えるだけ）
 */
export type HsDecided = {
  materialId: string;
  hsCode: string;
  originCountry: string | null;
  savedToMaterial: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  materialId: string | null;
  /** 発注の行の原産国（材料の原産国が空のときだけ材料に入れる） */
  rowOriginCountry: string | null;
  onDecided: (d: HsDecided) => void;
};

type PendingHs = {
  code: string;
  source: HsSource;
  copiedFromMaterialId?: string;
} | null;

export function HsDecideDialog({
  open,
  onOpenChange,
  materialId,
  rowOriginCountry,
  onDecided,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && materialId && (
        // 開くたびに state を作り直す（key）。読み込みは本体の effect の中の非同期コールバックで行う
        <HsDecideBody
          key={materialId}
          materialId={materialId}
          rowOriginCountry={rowOriginCountry}
          onDecided={onDecided}
          onOpenChange={onOpenChange}
        />
      )}
    </Dialog>
  );
}

function HsDecideBody({
  materialId,
  rowOriginCountry,
  onDecided,
  onOpenChange,
}: {
  materialId: string;
  rowOriginCountry: string | null;
  onDecided: (d: HsDecided) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [ctx, setCtx] = useState<MaterialHsContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // 答え（材料の値から始める）
  const [rows, setRows] = useState<CompositionRowInput[]>([]);
  const [spec, setSpec] = useState<ExportSpecInput>({ version: 1 });
  const [weight, setWeight] = useState<string>("");
  const [width, setWidth] = useState<string>("");
  const [touchedWeight, setTouchedWeight] = useState(false);
  const [touchedWidth, setTouchedWidth] = useState(false);
  const [pending, setPending] = useState<PendingHs>(null);
  const [manual, setManual] = useState<string>("");
  const [copiedNote, setCopiedNote] = useState<{
    code: string;
    diffs: string[];
    copiedComposition: boolean;
  } | null>(null);
  const [numberDraft, setNumberDraft] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    getMaterialHsContext(materialId).then((r) => {
      if (cancelled) return;
      setLoading(false);
      if (!r.ok) {
        toast.error(r.error);
        onOpenChange(false);
        return;
      }
      setCtx(r.data);
      setRows(r.data.compositionData.map((c) => ({ ...c })));
      const s: ExportSpecInput = { version: 1 };
      for (const k of EXPORT_SPEC_FIELDS) {
        const v = r.data.exportSpec?.[k];
        if (v !== undefined && v !== null)
          (s as Record<string, unknown>)[k] = v;
      }
      setSpec(s);
      setWeight(
        r.data.fabricWeight === null ? "" : String(r.data.fabricWeight),
      );
      setWidth(r.data.fabricWidth === null ? "" : String(r.data.fabricWidth));
    });
    return () => {
      cancelled = true;
    };
  }, [materialId, onOpenChange]);

  const composition = useMemo(() => toCompositionData(rows), [rows]);
  const weightNum = weight.trim() === "" ? null : Number(weight);
  const widthNum = width.trim() === "" ? null : Number(width);

  const result: HsResult | null = useMemo(() => {
    if (!ctx) return null;
    return classifyHs({
      materialType: ctx.materialType,
      compositionData: composition,
      exportSpec: {
        version: 1,
        ...Object.fromEntries(EXPORT_SPEC_FIELDS.map((k) => [k, spec[k]])),
      },
      fabricWeight:
        weightNum !== null && Number.isFinite(weightNum) ? weightNum : null,
      fabricWidth:
        widthNum !== null && Number.isFinite(widthNum) ? widthNum : null,
    });
  }, [ctx, composition, spec, weightNum, widthNum]);

  const question: HsQuestionKey | null = result ? nextHsQuestion(result) : null;

  // 確定に使う HS: 手入力 > 写した値 > 候補
  const decidedCode =
    manual.trim() !== ""
      ? manual.trim()
      : (pending?.code ?? result?.code ?? null);
  const decidedSource: HsSource =
    manual.trim() !== "" ? "MANUAL" : (pending?.source ?? "CANDIDATE");

  const setSpecField = (key: keyof ExportSpecInput, value: unknown) => {
    setSpec((prev) => {
      const next: ExportSpecInput = { ...prev, version: 1 };
      if (value === undefined) delete next[key];
      else (next as Record<string, unknown>)[key] = value;
      return next;
    });
    // 規格を変えたら写した HS は捨てる（候補を見直す）
    setPending(null);
  };

  const copyFrom = (ref: HsReferenceMaterial) => {
    if (!ctx) return;
    const r = buildCopyFromReference(
      {
        materialType: ctx.materialType,
        compositionData: composition,
        fabricWeight:
          weightNum !== null && Number.isFinite(weightNum) ? weightNum : null,
        fabricWidth:
          widthNum !== null && Number.isFinite(widthNum) ? widthNum : null,
      },
      ref,
      (t) => MATERIAL_TYPE_LABELS[t],
    );
    const s: ExportSpecInput = { version: 1 };
    for (const k of EXPORT_SPEC_FIELDS) {
      const v = r.exportSpec[k];
      if (v !== undefined && v !== null) (s as Record<string, unknown>)[k] = v;
    }
    setSpec(s);
    if (r.compositionData) setRows(r.compositionData.map((c) => ({ ...c })));
    setPending({
      code: r.hsCode,
      source: "COPIED",
      copiedFromMaterialId: ref.id,
    });
    setManual("");
    setCopiedNote({
      code: ref.materialCode,
      diffs: r.diffs,
      copiedComposition: r.compositionData !== null,
    });
  };

  const confirm = () => {
    if (!ctx || !decidedCode) return;
    startTransition(async () => {
      const r = await decideMaterialHs({
        materialId: ctx.id,
        compositionData: composition,
        exportSpec: {
          ...spec,
          hsSource: decidedSource,
          copiedFromMaterialId:
            decidedSource === "COPIED"
              ? pending?.copiedFromMaterialId
              : undefined,
        },
        hsCode: decidedCode,
        fabricWeight:
          touchedWeight &&
          weightNum !== null &&
          Number.isFinite(weightNum) &&
          weightNum > 0
            ? weightNum
            : undefined,
        fabricWidth:
          touchedWidth &&
          widthNum !== null &&
          Number.isFinite(widthNum) &&
          widthNum > 0
            ? widthNum
            : undefined,
        originCountry: rowOriginCountry,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      if (r.data.savedToMaterial) {
        toast.success(
          `${ctx.materialCode} の HS コード ${r.data.hsCode} を材料に保存しました`,
        );
      } else {
        toast.message(
          "材料マスターを編集できないため、この発注の行にだけ入れました",
        );
      }
      onDecided({
        materialId: ctx.id,
        hsCode: r.data.hsCode,
        originCountry: r.data.originCountry,
        savedToMaterial: r.data.savedToMaterial,
      });
      onOpenChange(false);
    });
  };

  // ---- 質問の描画 ---------------------------------------------------------
  const renderQuestion = () => {
    if (!result) return null;
    if (!question) {
      return (
        <p className="text-sm text-muted-foreground">
          {result.code
            ? "質問は終わりです。右の候補で確定するか、手で入力してください"
            : "この材料は判定の木で号まで決まりません。右の案内を見て手で入力してください"}
        </p>
      );
    }
    const kind = hsQuestionKind(question);
    const label = HS_QUESTION_LABELS[question];
    if (kind === "composition") {
      return (
        <div className="space-y-2">
          <p className="text-sm font-medium">{label}</p>
          <CompositionRows
            rows={rows}
            onChange={(next) => {
              setRows(next);
              setPending(null);
            }}
            total={compositionTotal(composition)}
            showLabel={false}
            emptyHint="「行を足す」で繊維と % を入れると、次の質問に進みます"
          />
        </div>
      );
    }
    if (kind === "number") {
      const isWeight = question === "fabricWeight";
      return (
        <div className="space-y-2">
          <p className="text-sm font-medium">{label}</p>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.1"
              className="w-[160px]"
              value={numberDraft}
              onChange={(e) => setNumberDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyNumber(isWeight);
                }
              }}
              aria-label={label}
            />
            <span className="text-sm text-muted-foreground">
              {isWeight ? "g/㎡" : "cm"}
            </span>
            <Button
              type="button"
              size="sm"
              onClick={() => applyNumber(isWeight)}
              disabled={numberDraft.trim() === ""}
            >
              次へ
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            答えは材料の{isWeight ? "目付" : "幅"}にも保存されます
          </p>
        </div>
      );
    }
    const options = hsQuestionOptions(question) ?? [];
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">{label}</p>
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <Button
              key={o.value}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                if (
                  question === "composition" ||
                  question === "fabricWeight" ||
                  question === "fabricWidth"
                )
                  return;
                setSpecField(
                  question,
                  kind === "boolean" ? o.value === "true" : o.value,
                );
              }}
            >
              {o.label}
            </Button>
          ))}
        </div>
      </div>
    );
  };

  const applyNumber = (isWeight: boolean) => {
    const v = numberDraft.trim();
    if (v === "" || !Number.isFinite(Number(v)) || Number(v) <= 0) return;
    if (isWeight) {
      setWeight(v);
      setTouchedWeight(true);
    } else {
      setWidth(v);
      setTouchedWidth(true);
    }
    setNumberDraft("");
    setPending(null);
  };

  const answered = ctx
    ? [
        composition.length > 0
          ? `混率: ${formatComposition(composition)}`
          : null,
        ...summarizeExportSpec({
          version: 1,
          ...Object.fromEntries(EXPORT_SPEC_FIELDS.map((k) => [k, spec[k]])),
        }),
        weightNum !== null ? `目付 ${weight} g/㎡` : null,
        widthNum !== null ? `幅 ${width} cm` : null,
      ].filter((v): v is string => !!v)
    : [];

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
      <DialogHeader>
        <DialogTitle>HS を決める</DialogTitle>
        <DialogDescription>
          {ctx
            ? `${ctx.materialCode} ${ctx.materialName}（${MATERIAL_TYPE_LABELS[ctx.materialType]}）。似た材料から写すか、質問に答えてください。確定すると材料マスターに保存されます`
            : "材料を読み込んでいます…"}
        </DialogDescription>
      </DialogHeader>

      {loading || !ctx || !result ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          読み込み中…
        </div>
      ) : (
        <div className="space-y-4">
          {!ctx.canEditMaterial && (
            <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              材料マスターを編集できない役割です。確定した HS
              はこの発注の行にだけ入ります（材料には保存されません）
            </div>
          )}

          {/* 1. 似た材料（案C） */}
          <ReferenceMaterials
            materialType={ctx.materialType}
            compositionData={composition}
            excludeId={ctx.id}
            onCopy={copyFrom}
          />
          {copiedNote && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <p className="font-medium">
                {copiedNote.code} から規格と HS コード
                {copiedNote.copiedComposition && "と混率"}を写しました（「この
                HS で確定」で保存）
              </p>
              {copiedNote.diffs.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-xs">
                  {copiedNote.diffs.map((d) => (
                    <li key={d}>違う所: {d}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* 2. 質問（1 問ずつ） */}
            <div className="space-y-3 rounded-md border p-3">
              <p className="text-xs text-muted-foreground">
                質問に答える（案B）
              </p>
              {renderQuestion()}
              {answered.length > 0 && (
                <div className="border-t pt-2 text-xs text-muted-foreground">
                  これまでの答え: {answered.join(" / ")}
                </div>
              )}
            </div>

            {/* 3. 候補 */}
            <div className="space-y-3 rounded-md border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">HS の候補</p>
                <Badge
                  variant="outline"
                  title="判定の木は澁澤WT と照合前。照合が済むまで「要確認」"
                >
                  要確認
                </Badge>
              </div>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-2xl font-mono">
                  {pending ? pending.code : displayHsCandidate(result)}
                </span>
                {pending ? (
                  <span className="text-xs text-muted-foreground">
                    似た材料から写した値
                  </span>
                ) : (
                  candidateNote(result) && (
                    <span className="text-xs text-muted-foreground">
                      {candidateNote(result)}
                    </span>
                  )
                )}
              </div>
              <p className="text-sm">{result.label}</p>
              {result.reasons.length > 0 && (
                <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                  {result.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
              {pending && result.code && result.code !== pending.code && (
                <div className="flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                  <AlertTriangle className="h-3 w-3" />
                  写した値 {pending.code} と、今の答えからの候補 {result.code}{" "}
                  が違います
                </div>
              )}
              <div className="space-y-1 border-t pt-2">
                <p className="text-xs text-muted-foreground">
                  手で入力（候補が出ないとき）
                </p>
                <Input
                  placeholder="例：5208.33"
                  maxLength={20}
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <DialogFooter className="gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isPending}
        >
          やめる
        </Button>
        <Button
          type="button"
          onClick={confirm}
          disabled={isPending || !ctx || !decidedCode}
        >
          {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          {decidedCode
            ? `この HS（${decidedCode}）で確定`
            : "HS が決まっていません"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
