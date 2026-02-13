import React, { useEffect, useMemo, useRef, useState } from "react";
import { useCookies } from "react-cookie";
import { useParams, useNavigate } from "react-router-dom";
import { read, utils, writeFile } from "xlsx";

import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import AlertsTable from "@/components/aec_model_components/AlertsTable";

import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  AlertCircle,
  BarChart3,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileDown,
  FileText,
  FileUp,
  FolderOpen,
  Plus,
  Sparkles,
  Table2,
  Zap,
} from "lucide-react";

import AppLayout from "@/components/general_component/AppLayout";
import AnalyticsDashboard from "@/components/general_component/AnalyticsDashboard";
import AbitatLogoLoader from "@/components/general_component/AbitatLogoLoader";
import SheetsTable from "@/components/aec_model_components/SheetsTable";
import ControlTable from "@/components/aec_model_components/ControlTable";
import SelectFolderModal from "@/components/aec_model_components/SelectFolderModal";
import SelectModelsModal from "@/components/aec_model_components/SelectModelModal";


import autoTable from "jspdf-autotable";

const backendUrl = import.meta.env.VITE_API_BACKEND_BASE_URL;

const emptyPlan = () => ({
  id: null,
  name: "",
  number: "",
  currentRevision: "",
  currentRevisionDate: "",
  plannedGenDate: "",
  actualGenDate: "",
  plannedReviewDate: "",
  actualReviewDate: "",
  plannedIssueDate: "",
  actualIssueDate: "",
  hasApprovalFlow: false,
  status: "",
});

const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

const excelSerialToISO = (n) => {
  if (typeof n !== "number" || !isFinite(n)) return "";
  const base = new Date(Date.UTC(1899, 11, 30));
  base.setUTCDate(base.getUTCDate() + Math.floor(n));
  return base.toISOString().slice(0, 10);
};

const dmyToISO = (s) => {
  const m = String(s || "").trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!m) return "";
  let [, dd, mm, yy] = m;
  const d = parseInt(dd, 10);
  const mo = parseInt(mm, 10) - 1;
  let y = parseInt(yy, 10);
  if (y < 100) y = 2000 + y;
  const dt = new Date(Date.UTC(y, mo, d));
  return isNaN(dt) ? "" : dt.toISOString().slice(0, 10);
};

const toISODate = (v) => {
  if (!v && v !== 0) return "";
  if (v instanceof Date) return isNaN(v) ? "" : v.toISOString().slice(0, 10);
  if (typeof v === "number") return excelSerialToISO(v);
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const mx = dmyToISO(s);
    if (mx) return mx;
    const d = new Date(s);
    return isNaN(d) ? "" : d.toISOString().slice(0, 10);
  }
  return "";
};

const isoToDMY = (iso) => {
  if (!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const [, y, mm, dd] = m;
  return `${dd}/${mm}/${y}`;
};

const isNombre = (h) => ["nombre de plano", "nombre", "sheet name", "title"].includes(norm(h));
const isNumero = (h) => ["número de plano", "numero de plano", "número", "numero", "sheet number", "no.", "no"].includes(norm(h));
const isGenProg = (h) => ["fecha gen. (programada)", "fecha de generación (programada)", "fecha de generacion (programada)", "planned generation date"].includes(norm(h));
const isRevProg = (h) => ["rev. técnica (programada)", "revisión técnica (programada)", "revision tecnica (programada)", "planned review date"].includes(norm(h));
const isEmiProg = (h) => ["emisión (programada)", "emision (programada)", "emisión a construcción (programada)", "planned issue date"].includes(norm(h));

// --- Componente Principal ---
export default function AECModelPlansPage() {
  const [cookies] = useCookies(["access_token"]);
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [alerts, setAlerts] = useState([]);

  const altProjectId = sessionStorage.getItem("altProjectId");
  const projectName = sessionStorage.getItem("projectName");

  const [viewMode, setViewMode] = useState("table");

  // Estados de Datos
  const [models, setModels] = useState([]);
  const [folderTree, setFolderTree] = useState([]);
  
  const [selectedModelsIds, setSelectedModelsIds] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState(null);

  const [plans, setPlans] = useState([]);
  
  const [modalModelsOpen, setModalModelsOpen] = useState(false);
  const [modalFoldersOpen, setModalFoldersOpen] = useState(false);
  
  const [error, setError] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingTree, setLoadingTree] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const fileInputRef = useRef(null);
  const reportRef = useRef(null); 
  const dashboardExportRef = useRef(null);

  const apiBase = (backendUrl || "").replace(/\/$/, "");
  const pId = encodeURIComponent(projectId || "");
  
  const TABLOID_LANDSCAPE_MM = [431.8, 279.4];
  const fmtDMY = (iso) => isoToDMY(iso || "");


  const safeJson = async (res, urlForMsg) => {
    const ctype = res.headers.get("content-type") || "";
    if (!ctype.includes("application/json")) {
      const txt = await res.text();
      throw new Error(
        `Respuesta no JSON (${res.status}). URL: ${urlForMsg}. Detalle: ${txt.slice(0, 200)}...`
      );
    }
    return res.json();
  };

  const stats = useMemo(() => {
    const total = plans.length;
    const completed = plans.filter((d) => d.actualIssueDate || d.actual_issue_date).length;
    const inReview = plans.filter(
      (d) => (d.actualReviewDate || d.actual_review_date) && !(d.actualIssueDate || d.actual_issue_date)
    ).length;
    const pending = total - completed - inReview;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inReview, pending, completionRate };
  }, [plans]);

  const loadAlerts = async () => {
    try {
      const r = await fetch(`${apiBase}/plans/${pId}/alerts`, { credentials: "include" });
      const j = await safeJson(r, "alerts");
      setAlerts(j.data?.alerts || []);
    } catch (e) {
      console.error("Error cargando alertas:", e);
      setAlerts([]);
    }
  };

  // 1. CARGA INICIAL
  useEffect(() => {
    const initData = async () => {
      setIsLoadingInitial(true);
      try {
        const [selFolders, selModels] = await Promise.allSettled([
            fetch(`${apiBase}/aec/${pId}/graphql-folders/get-selection`, { credentials: "include" }).then(r => r.json()),
            fetch(`${apiBase}/aec/${pId}/graphql-models/get-selection`, { credentials: "include" }).then(r => r.json())
        ]);

        if (selFolders.status === 'fulfilled') setSelectedFolderId(selFolders.value.data?.folderId || null);
        if (selModels.status === 'fulfilled') setSelectedModelsIds(selModels.value.data?.modelIds || []);

        const plansRes = await fetch(`${apiBase}/plans/${pId}/plans`, { credentials: "include" });
        const plansJson = await safeJson(plansRes, "plans");
        const loaded = plansJson.data?.plans ?? [];
        setPlans(loaded.length === 0 ? Array.from({ length: 10 }, emptyPlan) : loaded);
        
        await loadAlerts();

      } catch (err) {
        console.error("Error carga inicial:", err);
        if (plans.length === 0) setPlans(Array.from({ length: 10 }, emptyPlan));
      } finally {
        setIsLoadingInitial(false);
      }
    };

    if (pId) initData();
  }, [apiBase, pId]);

  // 2. HANDLERS
  const handleOpenModelsModal = async () => {
    setModalModelsOpen(true);
    if (models.length === 0) {
        setLoadingModels(true);
        const tId = toast.loading("Cargando lista de modelos..."); 
        try {
            const r = await fetch(`${apiBase}/aec/${pId}/graphql-models`, { credentials: "include" });
            const j = await safeJson(r, "graphql-models");
            if(!j.success && j.error) throw new Error(j.error);
            setModels(j.data?.models || []);
            toast.success("Modelos cargados", { id: tId });
        } catch (e) {
            console.error("Error cargando modelos:", e);
            toast.error("Error al obtener modelos.", { id: tId });
        } finally {
            setLoadingModels(false);
        }
    }
  };

  const handleOpenFoldersModal = async () => {
    setModalFoldersOpen(true);
    if (folderTree.length === 0) {
        if (!altProjectId) {
            toast.error("Falta ID de Data Management.");
            return;
        }
        setLoadingTree(true);
        const tId = toast.loading("Escaneando estructura de carpetas...");
        try {
            const endpoint = `${apiBase}/dm/project-folders?dmId=${altProjectId}`;
            const response = await fetch(endpoint, { credentials: "include" });
            const result = await safeJson(response, endpoint);
            if (!result.success) throw new Error(result.message);
            setFolderTree(result.data.folderTree || []);
            toast.success("Estructura cargada.", { id: tId });
        } catch (err) {
            console.error("Error cargando árbol DM:", err);
            toast.error("Error al cargar carpetas.", { id: tId });
        } finally {
            setLoadingTree(false);
        }
    }
  };

  const handleAddRow = () => setPlans((prev) => [...prev, emptyPlan()]);
  
  const handleDeleteRow = async (rowIndex) => {
    const row = plans[rowIndex];
    let deleteOk = true;
    if (row?.id) {
      try {
        const url = `${apiBase}/plans/${pId}/plans/${row.id}`;
        const res = await fetch(url, { method: "DELETE", credentials: "include" });
        if (!res.ok) deleteOk = false;
      } catch (e) {
        deleteOk = false;
        console.warn("DELETE falló", e);
      }
    }
    setPlans((prev) => prev.filter((_, i) => i !== rowIndex));
    if (deleteOk) toast.success("Plano eliminado.");
  };

  const handleClickImport = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    let tId;
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      tId = toast.loading("Importando Excel...");
      const buf = await file.arrayBuffer();
      const wb = read(buf, { cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = utils.sheet_to_json(ws, { header: 1, raw: false });
      if (!rows.length) throw new Error("Archivo vacío.");
      
      const headers = rows[0];
      let idxNombre = -1, idxNumero = -1, idxGen = -1, idxRev = -1, idxEmi = -1;
      headers.forEach((h, i) => {
        if (idxNombre === -1 && isNombre(h)) idxNombre = i;
        if (idxNumero === -1 && isNumero(h)) idxNumero = i;
        if (idxGen === -1 && isGenProg(h)) idxGen = i;
        if (idxRev === -1 && isRevProg(h)) idxRev = i;
        if (idxEmi === -1 && isEmiProg(h)) idxEmi = i;
      });

      if (idxNumero === -1 || idxNombre === -1) throw new Error("Faltan columnas requeridas.");

      const plansPayload = rows.slice(1).map((r) => {
          return { 
              name: String(r[idxNombre] ?? "").trim(), 
              number: String(r[idxNumero] ?? "").trim(),
              plannedGenDate: idxGen >= 0 ? toISODate(r[idxGen]) : "",
              plannedReviewDate: idxRev >= 0 ? toISODate(r[idxRev]) : "",
              plannedIssueDate: idxEmi >= 0 ? toISODate(r[idxEmi]) : ""
          };
      }).filter(p => p.name || p.number);

      if (!plansPayload.length) throw new Error("No hay datos válidos.");

      const url = `${apiBase}/plans/${pId}/plans/import`;
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plans: plansPayload }),
      });
      const data = await safeJson(res, url);
      if (!res.ok) throw new Error(data?.error || "Error importando.");

      e.target.value = "";
      const reloadRes = await fetch(`${apiBase}/plans/${pId}/plans`, { credentials: "include" });
      const reloadJson = await safeJson(reloadRes, "reload");
      setPlans(reloadJson.data?.plans || []);
      
      toast.success("Importación completada.", { id: tId });
    } catch (err) {
      console.error(err);
      if (tId) toast.error(`Error: ${err.message}`, { id: tId });
      else toast.error(`Error: ${err.message}`);
    }
  };

  const handleExportExcel = () => {
    const exportData = plans.map((r) => ({
      "Nombre de plano": r.name || "",
      "Número de plano": r.number || "",
      "Revisión Actual": r.currentRevision || "",
      "Fecha Rev. Actual": isoToDMY(r.currentRevisionDate || r.current_revision_date || ""),
      "Fecha gen. (programada)": isoToDMY(r.plannedGenDate || r.planned_gen_date || ""),
      "Fecha gen. (real)": isoToDMY(r.actualGenDate || r.actual_gen_date || ""),
      "Rev. técnica (programada)": isoToDMY(r.plannedReviewDate || r.planned_review_date || ""),
      "Rev. técnica (real)": isoToDMY(r.actualReviewDate || r.actual_review_date || ""),
      "Emisión (programada)": isoToDMY(r.plannedIssueDate || r.planned_issue_date || ""),
      "Emisión (real)": isoToDMY(r.actualIssueDate || r.actual_issue_date || ""),
      Conjunto: r.issueVersionSetName || r.sheet_version_set || "",
      Estado: r.status || "",
    }));
    const ws = utils.json_to_sheet(exportData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Planos");
    writeFile(wb, `Planos_${projectName || "Proyecto"}.xlsx`);
    toast.success("Excel exportado.");
  };

  const handleEdit = async (rowIndex, field, value) => {
    try {
      const planId = plans[rowIndex]?.id;
      setPlans((prev) => {
        const clone = [...prev];
        clone[rowIndex] = { ...clone[rowIndex], [field]: value };
        return clone;
      });
      if (!planId) return;
      const url = `${apiBase}/plans/${pId}/plans/${planId}`;
      const res = await fetch(url, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const json = await safeJson(res, url);
      if (!res.ok) throw new Error(json?.error);
    } catch (err) {
      console.error(err);
      toast.error("Error guardando cambio.");
    }
  };

  const handleSaveList = async () => {
    try {
      if (plans.some((p) => p.id)) {
        toast.info("Ya existen filas guardadas.");
        return;
      }
      const payload = plans.filter((p) => p.name || p.number).map((p) => ({
          name: p.name,
          number: p.number,
          plannedGenDate: p.plannedGenDate || "",
          plannedReviewDate: p.plannedReviewDate || "",
          plannedIssueDate: p.plannedIssueDate || "",
      }));

      if (!payload.length) {
        toast.warning("No hay datos para guardar.");
        return;
      }
      const tId = toast.loading("Guardando lista...");
      const url = `${apiBase}/plans/${pId}/plans/import`;
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plans: payload }),
      });
      if (!res.ok) throw new Error("Error al guardar.");
      
      const reloadRes = await fetch(`${apiBase}/plans/${pId}/plans`, { credentials: "include" });
      const reloadJson = await safeJson(reloadRes, "reload");
      setPlans(reloadJson.data?.plans || []);

      toast.success("Lista guardada.", { id: tId });
    } catch (e) {
      toast.error(e.message || "Error al guardar.");
    }
  };

  const handleSyncMatch = async () => {
    if (!selectedModelsIds.length || !selectedFolderId || !altProjectId) {
      toast.warning("Configura modelos y folder primero.");
      return;
    }
    setIsSyncing(true);
    const tId = toast.loading("Sincronizando con Autodesk...");
    try {
      const url = `${apiBase}/plans/${pId}/plans/match`;
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-alt-project-id": altProjectId,
          "selected-folder-id": selectedFolderId,
        },
        body: JSON.stringify({}),
      });
      const json = await safeJson(res, url);
      console.log("Respuesta", json)
      if (!res.ok) throw new Error(json?.error || "Error en sincronización.");
      
      const reloadRes = await fetch(`${apiBase}/plans/${pId}/plans`, { credentials: "include" });
      const reloadJson = await safeJson(reloadRes, "reload");
      setPlans(reloadJson.data?.plans || []);

      await loadAlerts();

      toast.success("Sincronización completada.", { id: tId });
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Falló la sincronización.", { id: tId });
    } finally {
      setIsSyncing(false);
    }
  };

  const hasPersistedRows = Array.isArray(plans) && plans.some((p) => p.id);

  if (isLoadingInitial || isSyncing) {
    return (
      <AppLayout>
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm animate-in fade-in duration-300">
          <AbitatLogoLoader className="scale-100" />
          <p className="mt-6 animate-pulse text-base font-medium text-gray-500">
            {isSyncing ? "Sincronizando datos con Autodesk..." : "Cargando planes..."}
          </p>
        </div>
      </AppLayout>
    );
  }

  const fetchAsDataURL = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`No pude cargar logo: ${url}`);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  };
  
  const loadLogo = async () => {
    const candidates = ["/Abitat_img.png", "/Abitat_img.jpg", "/Abitat_img.jpeg", "/Abitat_img.webp"];
    for (const u of candidates) {
      try { return await fetchAsDataURL(u); } catch (_) {}
    }
    return null; 
  };


  const handleExportPDF = async () => {
    if (viewMode === "alerts") {
      toast.info("La vista de alertas no tiene exportacion PDF.");
      return;
    }

    const tId = toast.loading("Generando PDF...");
    setIsExportingPdf(true);

    try {
      if (viewMode === "dashboard") {
        if (!dashboardExportRef.current) {
          throw new Error("No se pudo capturar el dashboard.");
        }

        const canvas = await html2canvas(dashboardExportRef.current, {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
          logging: false,
          windowWidth: dashboardExportRef.current.scrollWidth,
          windowHeight: dashboardExportRef.current.scrollHeight,
        });

        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({
          orientation: "landscape",
          unit: "mm",
          format: TABLOID_LANDSCAPE_MM,
          compress: true,
        });

        const margin = 8;
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const renderW = pageW - margin * 2;
        const renderH = (canvas.height * renderW) / canvas.width;
        const printableH = pageH - margin * 2;

        let rendered = 0;
        while (rendered < renderH) {
          if (rendered > 0) pdf.addPage();
          const y = margin - rendered;
          pdf.addImage(imgData, "PNG", margin, y, renderW, renderH, undefined, "FAST");
          rendered += printableH;
        }

        pdf.save(`Dashboard_${projectName || "Proyecto"}.pdf`);
        toast.success("PDF del dashboard generado.", { id: tId });
        return;
      }

      const logo = await loadLogo();
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: TABLOID_LANDSCAPE_MM,
        compress: true,
      });

      const margin = 6;
      const headerTop = 10;
      const title = `Proyecto: ${projectName || "Proyecto"}`;
      const sub =
        viewMode === "control"
          ? `Reporte de Control - ${new Date().toLocaleString("es-MX")}`
          : `Reporte de Planos - ${new Date().toLocaleString("es-MX")}`;

      const drawPdfHeader = () => {
        let x = margin;
        if (logo) {
          pdf.addImage(logo, "PNG", margin, 6, 24, 10);
          x = margin + 28;
        }
        pdf.setFontSize(12);
        pdf.text(title, x, headerTop);
        pdf.setFontSize(9);
        pdf.text(sub, x, headerTop + 5);
        const pageWInner = pdf.internal.pageSize.getWidth();
        pdf.text(`Pagina ${pdf.getNumberOfPages()}`, pageWInner - margin, headerTop, { align: "right" });
      };

      if (viewMode === "control") {
        const parseAnyDate = (value) => {
          if (!value) return null;
          if (value instanceof Date) {
            const d = new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0, 0);
            return Number.isNaN(d.getTime()) ? null : d;
          }
          const raw = String(value).trim();
          if (!raw) return null;
          const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (iso) {
            const [, y, m, d] = iso;
            const dt = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0, 0);
            return Number.isNaN(dt.getTime()) ? null : dt;
          }
          const dmy = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
          if (dmy) {
            let [, d, m, y] = dmy;
            if (y.length === 2) y = `20${y}`;
            const dt = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0, 0);
            return Number.isNaN(dt.getTime()) ? null : dt;
          }
          const parsed = new Date(raw);
          if (Number.isNaN(parsed.getTime())) return null;
          return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0, 0);
        };

        const formatDate = (value) => {
          const d = parseAnyDate(value);
          if (!d) return "-";
          const dd = String(d.getDate()).padStart(2, "0");
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const yyyy = d.getFullYear();
          return `${dd}/${mm}/${yyyy}`;
        };

        const monthNames = [
          "Enero",
          "Febrero",
          "Marzo",
          "Abril",
          "Mayo",
          "Junio",
          "Julio",
          "Agosto",
          "Septiembre",
          "Octubre",
          "Noviembre",
          "Diciembre",
        ];

        const startOfWeekMonday = (date) => {
          const d = new Date(date);
          const offset = (d.getDay() + 6) % 7;
          d.setDate(d.getDate() - offset);
          d.setHours(12, 0, 0, 0);
          return d;
        };

        const addDays = (date, days) => {
          const d = new Date(date);
          d.setDate(d.getDate() + days);
          return d;
        };

        const getFirst = (row, keys) => {
          for (const key of keys) {
            const value = row?.[key];
            if (value !== undefined && value !== null && String(value).trim() !== "") return value;
          }
          return "";
        };

        const controlRows = (plans || [])
          .filter((r) => (r.name || r.sheet_name || "").trim() || (r.number || r.sheet_number || "").trim())
          .map((r) => ({
            number: getFirst(r, ["number", "sheet_number"]),
            name: getFirst(r, ["name", "sheet_name"]),
            plannedGenDate: getFirst(r, ["plannedGenDate", "planned_gen_date"]),
            actualGenDate: getFirst(r, ["actualGenDate", "actual_gen_date"]),
            plannedReviewDate: getFirst(r, ["plannedReviewDate", "planned_review_date"]),
            actualReviewDate: getFirst(r, ["actualReviewDate", "actual_review_date"]),
            plannedIssueDate: getFirst(r, ["plannedIssueDate", "planned_issue_date"]),
            actualIssueDate: getFirst(r, ["actualIssueDate", "actual_issue_date"]),
          }));

        const allDates = [];
        for (const row of controlRows) {
          [
            row.plannedGenDate,
            row.actualGenDate,
            row.plannedReviewDate,
            row.actualReviewDate,
            row.plannedIssueDate,
            row.actualIssueDate,
          ].forEach((value) => {
            const d = parseAnyDate(value);
            if (d) allDates.push(d);
          });
        }

        const minDate = allDates.length ? new Date(Math.min(...allDates.map((d) => d.getTime()))) : new Date();
        const maxDate = allDates.length ? new Date(Math.max(...allDates.map((d) => d.getTime()))) : new Date();
        const startDate = startOfWeekMonday(minDate);
        const endDate = addDays(startOfWeekMonday(maxDate), 6);

        const weeks = [];
        let cursor = new Date(startDate);
        let weekNumber = 1;
        while (cursor.getTime() <= endDate.getTime()) {
          const start = new Date(cursor);
          const end = addDays(start, 6);
          weeks.push({ weekNumber, start, end });
          cursor = addDays(cursor, 7);
          weekNumber += 1;
        }

        const monthGroups = [];
        weeks.forEach((week) => {
          const key = `${week.start.getFullYear()}-${week.start.getMonth()}`;
          const last = monthGroups[monthGroups.length - 1];
          if (!last || last.key !== key) {
            monthGroups.push({
              key,
              name: monthNames[week.start.getMonth()],
              year: week.start.getFullYear(),
              count: 1,
            });
          } else {
            last.count += 1;
          }
        });

        const findWeekIndex = (value) => {
          const d = parseAnyDate(value);
          if (!d) return null;
          const idx = weeks.findIndex(
            (week) => d.getTime() >= week.start.getTime() && d.getTime() <= week.end.getTime()
          );
          return idx >= 0 ? idx : null;
        };

        const fixedColumns = [
          "#",
          "N. Plano",
          "Nombre",
          "Gen. Prog.",
          "Gen. Real",
          "Rev. Prog.",
          "Rev. Real",
          "Em. Prog.",
          "Em. Real",
        ];

        const monthHeader = [
          {
            content: "Informacion del Plano",
            colSpan: fixedColumns.length,
            styles: { halign: "left", fillColor: [243, 244, 246] },
          },
          ...monthGroups.map((group) => ({
            content: `${group.name} ${group.year}`,
            colSpan: group.count,
            styles: { halign: "center", fillColor: [243, 244, 246] },
          })),
        ];

        const weekHeader = [
          ...fixedColumns.map((label) => ({ content: label, styles: { halign: "center" } })),
          ...weeks.map((week) => {
            const sdd = String(week.start.getDate()).padStart(2, "0");
            const smm = String(week.start.getMonth() + 1).padStart(2, "0");
            const edd = String(week.end.getDate()).padStart(2, "0");
            const emm = String(week.end.getMonth() + 1).padStart(2, "0");
            return { content: `S${week.weekNumber}\n${sdd}/${smm}-${edd}/${emm}`, styles: { halign: "center" } };
          }),
        ];

        const body = controlRows.map((row, index) => {
          const plannedWeek = findWeekIndex(row.plannedIssueDate);
          const actualWeek = findWeekIndex(row.actualIssueDate);
          const weekCells = weeks.map((_, idx) => {
            if (plannedWeek === idx && actualWeek === idx) return "X/X";
            if (plannedWeek === idx || actualWeek === idx) return "X";
            return "";
          });

          return [
            index + 1,
            row.number || "-",
            row.name || "-",
            formatDate(row.plannedGenDate),
            formatDate(row.actualGenDate),
            formatDate(row.plannedReviewDate),
            formatDate(row.actualReviewDate),
            formatDate(row.plannedIssueDate),
            formatDate(row.actualIssueDate),
            ...weekCells,
          ];
        });

        const safeBody = body.length ? body : [["-", "-", "-", "-", "-", "-", "-", "-", "-", ...weeks.map(() => "")]];
        const fixedCount = fixedColumns.length;
        const repeatCols = Array.from({ length: fixedCount }, (_, i) => i);
        const columnStyles = {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 20 },
          2: { cellWidth: 40 },
          3: { cellWidth: 16, halign: "center" },
          4: { cellWidth: 16, halign: "center" },
          5: { cellWidth: 16, halign: "center" },
          6: { cellWidth: 16, halign: "center" },
          7: { cellWidth: 16, halign: "center" },
          8: { cellWidth: 16, halign: "center" },
        };
        weeks.forEach((_, idx) => {
          columnStyles[idx + fixedCount] = { cellWidth: 8, halign: "center" };
        });

        autoTable(pdf, {
          head: [monthHeader, weekHeader],
          body: safeBody,
          theme: "grid",
          margin: { left: margin, right: margin, top: headerTop + 12, bottom: margin },
          styles: {
            fontSize: 6,
            cellPadding: 1,
            overflow: "linebreak",
            valign: "middle",
          },
          headStyles: {
            fontStyle: "bold",
            textColor: [40, 40, 40],
          },
          columnStyles,
          horizontalPageBreak: true,
          horizontalPageBreakRepeat: repeatCols,
          didDrawPage: drawPdfHeader,
        });

        pdf.save(`Reporte_Control_${projectName || "Proyecto"}.pdf`);
        toast.success("PDF de control generado con calendario completo.", { id: tId });
        return;
      }

      const columns = [
        "#",
        "N. Plano",
        "Nombre",
        "Rev.",
        "Fecha Rev.",
        "Gen. Programada",
        "Gen. Real",
        "Ver.",
        "Ult. Version",
        "Rev. Programada",
        "Aprob.",
        "Rev. Real",
        "Ult. Flujo",
        "Estado Flujo",
        "Emision Prog.",
        "Emision Real",
        "Actualizado",
        "Conjunto",
        "Progreso",
      ];

      const rows = (plans || [])
        .filter((r) => (r.name || "").trim() || (r.number || "").trim())
        .map((r, i) => {
          const hasIssue = !!(r.actualIssueDate || r.actual_issue_date);
          const hasReview = !!(r.actualReviewDate || r.actual_review_date);
          const hasGen = !!(r.actualGenDate || r.actual_gen_date);
          const pct = hasIssue ? 100 : hasReview ? 66 : hasGen ? 33 : 0;
          const progressLabel = pct >= 100 ? "Completado" : pct >= 66 ? "En revision" : pct >= 33 ? "Generado" : "Pendiente";
          const approval = (r.hasApprovalFlow ?? r.has_approval_flow) ? "SI" : "-";

          return [
            i + 1,
            r.number || r.sheet_number || "",
            r.name || r.sheet_name || "",
            r.currentRevision || r.current_revision || "",
            fmtDMY(r.currentRevisionDate || r.current_revision_date || ""),
            fmtDMY(r.plannedGenDate || r.planned_gen_date || ""),
            fmtDMY(r.actualGenDate || r.actual_gen_date || ""),
            r.docsVersion || r.docs_version_number || "",
            fmtDMY(r.docsVersionDate || r.docs_last_modified || ""),
            fmtDMY(r.plannedReviewDate || r.planned_review_date || ""),
            approval,
            fmtDMY(r.actualReviewDate || r.actual_review_date || ""),
            fmtDMY(r.lastReviewDate || r.latest_review_date || ""),
            r.lastReviewStatus || r.latest_review_status || "-",
            fmtDMY(r.plannedIssueDate || r.planned_issue_date || ""),
            fmtDMY(r.actualIssueDate || r.actual_issue_date || ""),
            fmtDMY(r.issueUpdatedAt || r.sheet_updated_at || ""),
            r.issueVersionSetName || r.sheet_version_set || "",
            `${progressLabel} (${pct}%)`,
          ];
        });

      const safeRows = rows.length ? rows : [columns.map(() => "-")];
      autoTable(pdf, {
        head: [columns],
        body: safeRows,
        theme: "grid",
        margin: { left: margin, right: margin, top: headerTop + 12, bottom: margin },
        styles: {
          fontSize: 7,
          cellPadding: 1.2,
          overflow: "linebreak",
          valign: "middle",
        },
        headStyles: {
          fontStyle: "bold",
        },
        didDrawPage: drawPdfHeader,
      });

      pdf.save(`Reporte_Planos_${projectName || "Proyecto"}.pdf`);
      toast.success("PDF generado con exito.", { id: tId });
    } catch (e) {
      console.error(e);
      toast.error("Error al generar PDF.", { id: tId, description: e?.message });
    } finally {
      setIsExportingPdf(false);
    }
  };


  return (
    <AppLayout>
      {/* Contenedor Principal de Reporte 
        - ref={reportRef}: Para saber qué capturar.
        - bg-white: Fondo blanco para el PDF.
        - w-fit / min-w-full: Asegura que si la tabla es ancha, el contenedor crezca y no recorte.
      */}
      <div
        id="pdf-report-root"
        ref={reportRef}
        className="mx-auto max-w-[1800px] w-fit min-w-full space-y-6 p-6 bg-white"
      >
        <div className="flex flex-col justify-between gap-4 border-b border-border pb-6 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Project Sheets</h1>
              <Badge variant="outline" className="gap-1 rounded-full border-primary/20 bg-primary/5 px-2 text-primary">
                <Sparkles className="h-3 w-3" /> V2.0
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {projectName ? `Proyecto: ${projectName}` : "Gestión y seguimiento de planos"}
            </p>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex items-center rounded-lg border border-border bg-muted/50 p-1">
               <Button variant={viewMode === "table" ? "default" : "ghost"} size="sm" className={`h-8 gap-2 text-xs ${viewMode === "table" ? "bg-white text-black shadow-sm" : "text-muted-foreground hover:bg-transparent"}`} onClick={() => setViewMode("table")}>
                 <Table2 className="h-3.5 w-3.5" /> Tabla
               </Button>
               <Button variant={viewMode === "control" ? "default" : "ghost"} size="sm" className={`h-8 gap-2 text-xs ${viewMode === "control" ? "bg-white text-black shadow-sm" : "text-muted-foreground hover:bg-transparent"}`} onClick={() => setViewMode("control")}>
                 <CalendarDays className="h-3.5 w-3.5" /> Control
               </Button>
               <Button variant={viewMode === "dashboard" ? "default" : "ghost"} size="sm" className={`h-8 gap-2 text-xs ${viewMode === "dashboard" ? "bg-white text-black shadow-sm" : "text-muted-foreground hover:bg-transparent"}`} onClick={() => setViewMode("dashboard")}>
                 <BarChart3 className="h-3.5 w-3.5" /> Dashboard
               </Button>
             </div>
             <div className="flex items-center rounded-lg border border-border bg-muted/50 p-1">
              <Button
                 variant={viewMode === "alerts" ? "default" : "ghost"}
                size="sm"
                className={`h-8 gap-2 text-xs ${viewMode === "alerts" ? "bg-white text-black shadow-sm" : "text-muted-foreground hover:bg-transparent"}`}
                onClick={() => setViewMode("alerts")}
              >
                <AlertCircle className="h-3.5 w-3.5" />
                Alertas
                <Badge variant="secondary" className="ml-1 h-5 px-1 text-[10px]">{alerts.length}</Badge>
              </Button>
             </div>
           </div>
        </div>

        {viewMode === "table" ? (
          <>
            {/* data-html2canvas-ignore hace que esta barra NO salga en el PDF */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-3" data-html2canvas-ignore="true">
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 bg-background shadow-sm hover:bg-zinc-50"
                        onClick={handleOpenModelsModal}
                      >
                        <Boxes className="h-4 w-4 text-zinc-500" />
                        <span className="hidden sm:inline">Modelos</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Seleccionar modelos BIM</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 bg-background shadow-sm hover:bg-zinc-50"
                        onClick={handleOpenFoldersModal}
                      >
                        <FolderOpen className="h-4 w-4 text-zinc-500" />
                        <span className="hidden sm:inline">Folder</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Seleccionar carpeta de publicación</TooltipContent>
                  </Tooltip>
                
                </TooltipProvider>
                
                <div className="mx-1 hidden h-6 w-px bg-border sm:block" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2 hover:bg-background">
                      <FileUp className="h-4 w-4 text-zinc-500" /> <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={handleClickImport}><FileUp className="mr-2 h-4 w-4" /> Excel (.xlsx)</DropdownMenuItem>
                  </DropdownMenuContent>

                </DropdownMenu>
                <Button variant="ghost" size="sm" className="gap-2 hover:bg-background" onClick={handleExportExcel}><FileDown className="h-4 w-4 text-emerald-600" /></Button>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                             <Button variant="ghost" size="sm" className="gap-2 hover:bg-background" onClick={handleExportPDF} disabled={isExportingPdf}>
                                <FileText className="h-4 w-4 text-red-600" />
                             </Button>
                        </TooltipTrigger>
                        <TooltipContent>{isExportingPdf ? "Generando PDF..." : "Exportar PDF (Doble Carta)"}</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
              
              </div>

              <div className="ml-auto flex items-center gap-2">
                 <Button variant="secondary" size="sm" onClick={handleAddRow}><Plus className="w-3 h-3"/> Fila</Button>
                 {!hasPersistedRows && <Button variant="outline" size="sm" onClick={handleSaveList}>Guardar Todo</Button>}
                 <Button size="sm" className="bg-[rgb(170,32,47)] text-white hover:bg-[rgb(150,28,42)]" onClick={handleSyncMatch} disabled={isSyncing}><Zap className="w-3 h-3"/> Sincronizar</Button>
              </div>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
            </div>

            {error && <div className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-700"><AlertCircle className="h-4 w-4" /> {error}</div>}

            <SheetsTable data={plans} onEdit={handleEdit} onDeleteRow={handleDeleteRow} />
          </>
        ) : viewMode === "control" ? (
          <div className="bg-white p-4">
            <div className="mb-4 flex justify-end" data-html2canvas-ignore="true">
              <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2" disabled={isExportingPdf}>
                <FileText className="h-4 w-4 text-red-600" />
                {isExportingPdf ? "Generando..." : "Descargar Reporte PDF"}
              </Button>
            </div>
            <ControlTable data={plans} />
          </div>
        ) : viewMode === "alerts" ? (
          <div className="bg-white p-4">
            <AlertsTable data={alerts} />
          </div>
        ) : (
          <div ref={dashboardExportRef} className="bg-white p-4">
            <AnalyticsDashboard data={plans} />
            <div className="mt-4 flex justify-end" data-html2canvas-ignore="true">
              <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2" disabled={isExportingPdf}>
                <FileText className="h-4 w-4 text-red-600" />
                {isExportingPdf ? "Generando..." : "Descargar Reporte PDF"}
              </Button>
            </div>
          </div>
        )}

        <SelectModelsModal
          models={models}
          open={modalModelsOpen}
          loading={loadingModels} 
          onClose={() => setModalModelsOpen(false)}
          onSave={async (ids) => {
            const url = `${apiBase}/aec/${pId}/graphql-models/set-selection`;
          
            const modelMeta = (models || [])
              .filter((m) => ids.includes(m.id))
              .map((m) => ({
                id: m.id,
                name: m.name || m.displayName || m.title || m.fileName || "",
              }));
          
            await fetch(url, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ modelIds: ids, modelMeta }),
            });
          
            setSelectedModelsIds(ids);
            setModalModelsOpen(false);
          }}
        />

        <SelectFolderModal
          open={modalFoldersOpen}
          loading={loadingTree}
          onClose={() => setModalFoldersOpen(false)}
          folderTree={folderTree}
          selectedFolderId={selectedFolderId}
          onSave={async (folderId) => {
            const url = `${apiBase}/aec/${pId}/graphql-folders/set-selection`;
            await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folderId }) });
            setSelectedFolderId(folderId);
            setModalFoldersOpen(false);
          }}
        />
      </div>
    </AppLayout>
  );
}


