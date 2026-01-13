import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Check, X, Trash2, Calendar, FileText, ClipboardCheck, Send,
  ChevronUp, ChevronDown, ChevronsUpDown, Columns3, Search, Filter, Eye, EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* --- CONFIGURACIÓN DE COLUMNAS --- */
const COLUMN_DEFINITIONS = [
  { id: "index", label: "#", group: "basic", width: "w-12" },
  { id: "number", label: "N° Plano", group: "basic", sortable: true, width: "min-w-[100px]" },
  { id: "name", label: "Nombre", group: "basic", sortable: true, width: "min-w-[140px]" },
  { id: "currentRevision", label: "Rev.", group: "basic", tooltip: "Revisión actual del plano", sortable: true, width: "w-20" },
  { id: "currentRevisionDate", label: "Fecha Rev.", group: "basic", sortable: true, width: "w-28" },
  
  { id: "plannedGenDate", label: "Gen. Programada", group: "generation", tooltip: "Fecha programada de generación", sortable: true, width: "w-36" },
  { id: "actualGenDate", label: "Gen. Real", group: "generation", sortable: true, width: "w-28" },
  { id: "docsVersion", label: "Ver.", group: "generation", width: "w-16" },
  { id: "docsVersionDate", label: "Últ. Versión", group: "generation", sortable: true, width: "w-28" },
  
  { id: "plannedReviewDate", label: "Rev. Programada", group: "review", tooltip: "Fecha programada de revisión técnica", sortable: true, width: "w-36" },
  { id: "hasApprovalFlow", label: "Aprob.", group: "review", tooltip: "Aprobación en Docs", width: "w-20" },
  { id: "actualReviewDate", label: "Rev. Real", group: "review", sortable: true, width: "w-28" },
  { id: "lastReviewDate", label: "Últ. Flujo", group: "review", sortable: true, width: "w-28" },
  { id: "lastReviewStatus", label: "Estado Flujo", group: "review", sortable: true, width: "w-24" },
  
  { id: "plannedIssueDate", label: "Emisión Prog.", group: "issue", tooltip: "Fecha programada de emisión a construcción", sortable: true, width: "w-36" },
  { id: "actualIssueDate", label: "Emisión Real", group: "issue", sortable: true, width: "w-28" },
  { id: "issueUpdatedAt", label: "Actualizado", group: "issue", sortable: true, width: "w-28" },
  { id: "issueVersionSetName", label: "Conjunto", group: "issue", sortable: true, width: "w-24" },
  
  { id: "progress", label: "Progreso", group: "status", width: "w-32" },
  { id: "actions", label: "Acciones", group: "status", width: "w-24" },
];

const COLUMN_GROUPS = {
  basic: { label: "Información Básica", color: "bg-zinc-500" },
  generation: { label: "Generación", color: "bg-blue-500" },
  review: { label: "Revisión", color: "bg-purple-500" },
  issue: { label: "Emisión", color: "bg-blue-500" },
  status: { label: "Estado", color: "bg-zinc-500" },
};

/* --- HELPERS --- */
const isoToDMY = (iso) => {
  if (!iso) return "";
  const m = String(iso).substring(0, 10).match(/^\d{4}-\d{2}-\d{2}$/);
  if (!m) return "";
  const [y, mm, dd] = m[0].split("-");
  return `${dd}/${mm}/${y}`;
};

const dmyToISO = (dmy) => {
  if (!dmy) return "";
  const m = String(dmy).trim().match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})$/);
  if (!m) return "";
  let [, dd, mm, yy] = m;
  const d = parseInt(dd, 10);
  const mo = parseInt(mm, 10) - 1;
  let y = parseInt(yy, 10);
  if (y < 100) y = 2000 + y;
  const dt = new Date(Date.UTC(y, mo, d));
  return isNaN(dt) ? "" : dt.toISOString().slice(0, 10);
};

const toInputDateValue = (dmy) => {
  if (!dmy) return "";
  const parts = dmy.split('/');
  if (parts.length !== 3) return "";
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

const toBool = (v) => v === true || v === 1 || v === "1" || String(v).toLowerCase() === "true";

/* --- SUB-COMPONENTES --- */

const ProgressBar = ({ pct }) => {
  let info = { color: "bg-gray-300", label: "Pendiente", textColor: "text-gray-500" };
  if (pct >= 100) info = { color: "bg-green-600", label: "Completado", textColor: "text-green-700" };
  else if (pct >= 66) info = { color: "bg-blue-600", label: "En revisión", textColor: "text-blue-700" };
  else if (pct >= 33) info = { color: "bg-yellow-500", label: "Generado", textColor: "text-yellow-700" };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col gap-1 min-w-[80px]">
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
              <div
                className={`h-full rounded-full transition-all duration-500 ${info.color}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px]">
               <span className={`font-medium ${info.textColor}`}>{info.label}</span>
               <span className="font-bold">{pct}%</span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {info.label} ({pct}%)
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const StatusBadge = ({ status }) => {
  const s = String(status || "").toUpperCase();
  let variant = "outline";
  let className = "text-[10px]";

  // Backend ahora manda: APPROVED, REJECTED, IN_REVIEW
  if (s === "APPROVED" || s === "APROBADO") {
    variant = "default";
    className += " bg-emerald-500 hover:bg-emerald-600 text-white";
  } else if (s === "REJECTED" || s === "RECHAZADO") {
    variant = "destructive"; // Rojo
  } else if (s === "IN_REVIEW" || s.includes("REVIEW") || s.includes("REVISION")) {
    variant = "secondary"; // Cambio sugerido: Azul o Amarillo para "En proceso"
    className += " bg-blue-500 hover:bg-blue-600 text-white";
  } else {
    className += " text-muted-foreground";
  }

  return (
    <Badge variant={variant} className={className}>
      {status || "—"}
    </Badge>
  );
};

const DateCell = ({ value, editable, onChange, onBlur }) => {
  if (editable) {
    return (
      <div className="relative group w-full">
        <Input
          type="date"
          value={toInputDateValue(value)}
          onChange={(e) => onChange?.(e.target.value)}
          onBlur={onBlur}
          className="h-7 text-xs cursor-pointer px-1 pr-6 w-full"
        />
        <Calendar className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none opacity-50" />
      </div>
    );
  }
  return <span className={cn("text-xs whitespace-nowrap", !value && "text-muted-foreground italic")}>{value || "—"}</span>;
};

const SortableHeader = ({ children, tooltip, icon: Icon, sortable, sortDirection, onSort, className }) => {
  const content = (
    <div
      className={cn("flex items-center gap-1.5 select-none", sortable && "cursor-pointer hover:text-foreground transition-colors", className)}
      onClick={sortable ? onSort : undefined}
    >
      {Icon && <Icon className="h-3 w-3 opacity-70" />}
      <span className="truncate font-semibold">{children}</span>
      {sortable && (
        <span className="ml-auto">
          {sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : 
           sortDirection === "desc" ? <ChevronDown className="h-3 w-3" /> : 
           <ChevronsUpDown className="h-3 w-3 opacity-30" />}
        </span>
      )}
    </div>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="top" className="text-xs">{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return content;
};

const ColumnVisibilitySelector = ({ columns, visibleColumns, onToggle }) => {
  const groups = useMemo(() => {
    const g = {};
    columns.forEach(col => {
      if(!g[col.group]) g[col.group] = [];
      g[col.group].push(col);
    });
    return g;
  }, [columns]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2 border-dashed">
          <Columns3 className="h-4 w-4" />
          <span className="hidden sm:inline">Columnas</span>
          <Badge variant="secondary" className="h-5 px-1 text-[10px]">{visibleColumns.size}</Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end">
        <div className="p-3 border-b bg-muted/20">
          <h4 className="font-medium text-sm">Visibilidad de columnas</h4>
        </div>
        <div className="max-h-[300px] overflow-y-auto p-2">
          {Object.entries(groups).map(([groupKey, cols]) => (
            <div key={groupKey} className="mb-4 last:mb-0">
              <div className="flex items-center gap-2 px-2 mb-2">
                <div className={cn("w-2 h-2 rounded-full", COLUMN_GROUPS[groupKey]?.color)} />
                <span className="text-xs font-bold text-muted-foreground uppercase">{COLUMN_GROUPS[groupKey]?.label}</span>
              </div>
              {cols.map(col => (
                <div 
                    key={col.id} 
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded cursor-pointer select-none" 
                    // Eliminamos el onClick del div para que no interfiera con el Checkbox
                >
                  <Checkbox 
                    checked={visibleColumns.has(col.id)} 
                    id={`col-${col.id}`} 
                    onCheckedChange={() => onToggle(col.id)} 
                  />
                  <label htmlFor={`col-${col.id}`} className="text-sm cursor-pointer flex-1">{col.label}</label>
                  {visibleColumns.has(col.id) ? (
                    <Eye className="h-3 w-3 text-muted-foreground ml-auto" />
                  ) : (
                    <EyeOff className="h-3 w-3 text-muted-foreground/50 ml-auto" />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="p-2 border-t bg-muted/20 flex justify-between">
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => columns.forEach(c => !visibleColumns.has(c.id) && onToggle(c.id))}>
                Mostrar Todo
            </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default function SheetsTable({
  data = [],
  onEdit = () => {},
  onDeleteRow = () => {},
}) {
  const [rows, setRows] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ field: "", direction: null });
  const [visibleColumns, setVisibleColumns] = useState(new Set(COLUMN_DEFINITIONS.map(c => c.id)));

  const DATE_FIELDS = useMemo(() => [
    "plannedGenDate", "actualGenDate", "plannedReviewDate", "actualReviewDate", "plannedIssueDate", "actualIssueDate",
  ], []);

  const normalizeRow = (sheet) => ({
    id: sheet.id ?? sheet.plan_id ?? null,
    name: sheet.name ?? sheet.sheet_name ?? "",
    number: sheet.number ?? sheet.sheet_number ?? "",
    currentRevision: sheet.currentRevision ?? sheet.current_revision ?? "",
    currentRevisionDate: isoToDMY(sheet.currentRevisionDate ?? sheet.current_revision_date ?? ""),
    plannedGenDate: isoToDMY(sheet.plannedGenDate ?? sheet.planned_gen_date ?? ""),
    actualGenDate: isoToDMY(sheet.actualGenDate ?? sheet.actual_gen_date ?? ""),
    docsVersion: sheet.docsVersion ?? sheet.docs_version_number ?? "",
    docsVersionDate: isoToDMY(sheet.docsVersionDate ?? sheet.docs_last_modified ?? ""),
    plannedReviewDate: isoToDMY(sheet.plannedReviewDate ?? sheet.planned_review_date ?? ""),
    actualReviewDate: isoToDMY(sheet.actualReviewDate ?? sheet.actual_review_date ?? ""),
    hasApprovalFlow: toBool(sheet.hasApprovalFlow ?? sheet.has_approval_flow ?? false),
    lastReviewDate: isoToDMY(sheet.lastReviewDate ?? sheet.latest_review_date ?? ""),
    lastReviewStatus: sheet.lastReviewStatus ?? sheet.latest_review_status ?? "",
    plannedIssueDate: isoToDMY(sheet.plannedIssueDate ?? sheet.planned_issue_date ?? ""),
    actualIssueDate: isoToDMY(sheet.actualIssueDate ?? sheet.actual_issue_date ?? ""),
    issueUpdatedAt: isoToDMY(sheet.issueUpdatedAt ?? sheet.sheet_updated_at ?? ""),
    issueVersionSetName: sheet.issueVersionSetName ?? sheet.sheet_version_set ?? "",
    status: sheet.status ?? "",
  });

  useEffect(() => {
    setRows(Array.isArray(data) ? data.map(normalizeRow) : []);
  }, [data]);

  const processedRows = useMemo(() => {
    let result = [...rows];
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(r => 
        r.name.toLowerCase().includes(lower) || 
        r.number.toLowerCase().includes(lower) ||
        r.issueVersionSetName.toLowerCase().includes(lower)
      );
    }
    if (sortConfig.field && sortConfig.direction) {
      result.sort((a, b) => {
        const valA = a[sortConfig.field] || "";
        const valB = b[sortConfig.field] || "";
        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [rows, searchTerm, sortConfig]);

  const handleSort = (field) => {
    setSortConfig(prev => {
      if (prev.field !== field) return { field, direction: "asc" };
      if (prev.direction === "asc") return { field, direction: "desc" };
      return { field: "", direction: null };
    });
  };

  // --- CORRECCIÓN EN TOGGLE COLUMN ---
  // Nos aseguramos de crear un nuevo Set para forzar el re-render
  const toggleColumn = useCallback((id) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const getOriginalIndex = (rowObject) => rows.indexOf(rowObject);

  const handleChange = (rowObject, field, value) => {
    const idx = getOriginalIndex(rowObject);
    if (idx === -1) return;
    setRows(prev => {
      const clone = [...prev];
      clone[idx] = { ...clone[idx], [field]: value };
      return clone;
    });
  };

  const handleBlur = (rowObject, field, value) => {
    const idx = getOriginalIndex(rowObject);
    if (idx === -1) return;
    if (DATE_FIELDS.includes(field)) {
      const iso = dmyToISO(value) || null;
      onEdit(idx, field, iso);
    } else {
      onEdit(idx, field, value);
    }
  };

  const handleDateInput = (rowObject, field, dateValueYYYYMMDD) => {
    if (!dateValueYYYYMMDD) {
      handleChange(rowObject, field, "");
      return;
    }
    const [y, m, d] = dateValueYYYYMMDD.split('-');
    const newDMY = `${d}/${m}/${y}`;
    handleChange(rowObject, field, newDMY);
  };

  const getProgress = (r) => {
    if (r.actualIssueDate) return 100;
    if (r.actualReviewDate) return 66;
    if (r.actualGenDate) return 33;
    return 0;
  };

  const isVisible = (id) => visibleColumns.has(id);

  return (
    <div className="space-y-4">
      {/* TOOLBAR */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between bg-card p-2 rounded-lg border">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, nombre o conjunto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 bg-background"
          />
          {searchTerm && (
            <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0" onClick={() => setSearchTerm("")}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* PASAMOS toggleColumn COMO PROP */}
          <ColumnVisibilitySelector 
            columns={COLUMN_DEFINITIONS} 
            visibleColumns={visibleColumns} 
            onToggle={toggleColumn} 
          />
          {searchTerm && (
            <Badge variant="secondary" className="h-9 px-3">
              <Filter className="h-3 w-3 mr-1" /> {processedRows.length} resultados
            </Badge>
          )}
        </div>
      </div>

      {/* TABLA */}
      <div className="rounded-md border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table className="w-full text-xs">
            <TableHeader>
              <TableRow className="bg-muted/50 border-b border-border hover:bg-muted/50">
                {isVisible("index") && <TableHead className="py-1" />}
                {Object.keys(COLUMN_GROUPS).map(groupKey => {
                   const groupCols = COLUMN_DEFINITIONS.filter(c => c.group === groupKey && isVisible(c.id));
                   if (groupCols.length === 0) return null;
                   const style = groupKey === "generation" || groupKey === "issue" ? "bg-blue-50 text-blue-700 border-b-blue-200" : "bg-zinc-50 text-zinc-700 border-b-zinc-200";
                   return (
                     <TableHead key={groupKey} colSpan={groupCols.length} className={`text-center py-2 text-[10px] font-bold uppercase tracking-wider border-l border-r border-white ${style}`}>
                       {COLUMN_GROUPS[groupKey].label}
                     </TableHead>
                   );
                })}
              </TableRow>
              <TableRow className="bg-background border-b-2 border-border hover:bg-background">
                {COLUMN_DEFINITIONS.map((col) => {
                  if (!isVisible(col.id)) return null;
                  let cellClass = "h-10 px-3 py-2 border-r last:border-r-0 border-border/50";
                  if (col.group === "generation" || col.group === "issue") cellClass += " bg-blue-50/30";
                  return (
                    <TableHead key={col.id} className={`${col.width} ${cellClass}`}>
                      <SortableHeader
                        icon={col.id === "number" ? FileText : col.id.includes("Date") ? Calendar : null}
                        tooltip={col.tooltip}
                        sortable={col.sortable}
                        sortDirection={sortConfig.field === col.id ? sortConfig.direction : null}
                        onSort={() => handleSort(col.id)}
                      >
                        {col.label}
                      </SortableHeader>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.size} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText className="h-8 w-8 opacity-20" />
                      <p>No se encontraron planos</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                processedRows.map((r) => {
                  const realIndex = getOriginalIndex(r); 
                  const progress = getProgress(r);
                  const isComplete = progress === 100;
                  return (
                    <TableRow key={r.id || `temp-${Math.random()}`} className={`group hover:bg-muted/50 transition-colors ${isComplete ? "bg-green-50/40 hover:bg-green-50/60" : ""}`}>
                      {isVisible("index") && <TableCell className="text-center font-mono text-muted-foreground bg-muted/20 border-r">{realIndex + 1}</TableCell>}
                      {isVisible("number") && <TableCell className="p-1 border-r"><Input value={r.number} onChange={(e) => handleChange(r, "number", e.target.value)} onBlur={(e) => handleBlur(r, "number", e.target.value)} className="h-7 text-xs border-transparent focus:border-primary bg-transparent font-medium" /></TableCell>}
                      {isVisible("name") && <TableCell className="p-1 border-r"><Input value={r.name} onChange={(e) => handleChange(r, "name", e.target.value)} onBlur={(e) => handleBlur(r, "name", e.target.value)} className="h-7 text-xs border-transparent focus:border-primary bg-transparent" /></TableCell>}
                      {isVisible("currentRevision") && <TableCell className="text-center border-r"><Badge variant="outline" className="bg-white">{r.currentRevision}</Badge></TableCell>}
                      {isVisible("currentRevisionDate") && <TableCell className="border-r text-muted-foreground">{r.currentRevisionDate}</TableCell>}
                      {isVisible("plannedGenDate") && <TableCell className="p-1 border-r bg-blue-50/10"><DateCell editable value={r.plannedGenDate} onChange={(v) => handleDateInput(r, "plannedGenDate", v)} onBlur={() => handleBlur(r, "plannedGenDate", r.plannedGenDate)} /></TableCell>}
                      {isVisible("actualGenDate") && <TableCell className="border-r bg-blue-50/20"><DateCell value={r.actualGenDate} /></TableCell>}
                      {isVisible("docsVersion") && <TableCell className="text-center border-r bg-blue-50/20 font-mono">{r.docsVersion}</TableCell>}
                      {isVisible("docsVersionDate") && <TableCell className="border-r bg-blue-50/20"><DateCell value={r.docsVersionDate} /></TableCell>}
                      {isVisible("plannedReviewDate") && <TableCell className="p-1 border-r"><DateCell editable value={r.plannedReviewDate} onChange={(v) => handleDateInput(r, "plannedReviewDate", v)} onBlur={() => handleBlur(r, "plannedReviewDate", r.plannedReviewDate)} /></TableCell>}
                      {isVisible("hasApprovalFlow") && <TableCell className="text-center border-r">{r.hasApprovalFlow ? <Check className="h-4 w-4 text-emerald-500 mx-auto" /> : <div className="h-1.5 w-1.5 rounded-full bg-gray-200 mx-auto" />}</TableCell>}
                      {isVisible("actualReviewDate") && <TableCell className="border-r"><DateCell value={r.actualReviewDate} /></TableCell>}
                      {isVisible("lastReviewDate") && <TableCell className="border-r"><DateCell value={r.lastReviewDate} /></TableCell>}
                      {isVisible("lastReviewStatus") && <TableCell className="border-r"><StatusBadge status={r.lastReviewStatus} /></TableCell>}
                      {isVisible("plannedIssueDate") && <TableCell className="p-1 border-r bg-blue-50/10"><DateCell editable value={r.plannedIssueDate} onChange={(v) => handleDateInput(r, "plannedIssueDate", v)} onBlur={() => handleBlur(r, "plannedIssueDate", r.plannedIssueDate)} /></TableCell>}
                      {isVisible("actualIssueDate") && <TableCell className="border-r bg-blue-50/20"><DateCell value={r.actualIssueDate} /></TableCell>}
                      {isVisible("issueUpdatedAt") && <TableCell className="border-r bg-blue-50/20"><DateCell value={r.issueUpdatedAt} /></TableCell>}
                      {isVisible("issueVersionSetName") && <TableCell className="border-r bg-blue-50/20 text-muted-foreground">{r.issueVersionSetName}</TableCell>}
                      {isVisible("progress") && <TableCell className="px-2 border-r bg-gray-50/30"><ProgressBar pct={progress} /></TableCell>}
                      {isVisible("actions") && <TableCell className="text-center bg-gray-50/30"><Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => onDeleteRow(realIndex)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="flex justify-between items-center text-xs text-muted-foreground px-1">
        <div>Mostrando {processedRows.length} de {rows.length} registros</div>
        <div className="flex gap-4">
           <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Generación/Emisión</div>
           <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-500"></div> Revisión</div>
        </div>
      </div>
    </div>
  );
}