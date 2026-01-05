import os

file_path = "src/app/page.tsx"

new_imports = """\"use client\";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type User } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Play,
  Square,
  Trash2,
  Timer,
  TrendingUp,
  Cloud,
  LogOut,
  RefreshCw,
  Mail,
  Search,
  Download,
  Filter,
  Loader2,
  BarChart3,
  Calendar as CalendarIcon,
  PieChart as PieChartIcon,
  MoreVertical,
  Target,
  Flame,
  Plus,
  Pencil,
  X,
  Pause,
  CheckCircle2,
  AlertTriangle,
  Info,
  BookOpen,
  Link as LinkIcon,
  Database,
} from "lucide-react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  AreaChart,
  Area,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

import { 
  Category, 
  Topic, 
  ReadingStatus, 
  ReadingType, 
  ReadingItem, 
  Session, 
  Running, 
  DailyLog, 
  Milestone, 
  Snapshot, 
  CloudStatus, 
  RangeFilter, 
  ReadingStatusFilter 
} from "@/types/tracking";

import { 
  OLD_COLOR_MAP, 
  DEFAULT_CATEGORIES, 
  DEFAULT_TOPICS, 
  getRandomBrightColor,
  LS_CATEGORIES,
  LS_TOPICS,
  LS_READING,
  LS_SESSIONS,
  LS_TARGET,
  LS_UPDATED_AT,
  LS_RUNNING,
  LS_LOGS,
  LS_MILESTONES
} from "@/lib/constants";

import { 
  fmtTime, 
  fmtDuration, 
  fmtCompact, 
  fmtHmFromMs, 
  fmtHmFromHours, 
  pad2 
} from "@/lib/formatters";

import { 
  uid, 
  startOfDayMs, 
  startOfWeekMs, 
  sessionDurationMs, 
  wallDurationMs, 
  overlapActiveMs, 
  getCategoryPlaceholder, 
  getUniqueLabelsForCategory, 
  parseTags, 
  roundToNearest5Min 
} from "@/lib/helpers";

import { supabase } from "@/lib/supabase";
import { usePersistentState } from "@/hooks/usePersistentState";

import { ActiveTimer } from "@/components/tracking/ActiveTimer";
import { ActivityHeatmap } from "@/components/tracking/ActivityHeatmap";
import { SessionDialog } from "@/components/tracking/SessionDialog";
import { ReadingDialog } from "@/components/tracking/ReadingDialog";
import { WordCountDialog } from "@/components/tracking/WordCountDialog";
import { MilestoneDialog } from "@/components/tracking/MilestoneDialog";
import { MilestonesWidget } from "@/components/tracking/MilestonesWidget";

import { MiniDateTimePicker } from "@/components/ui/custom/MiniDateTimePicker";
import { ToastViewport, ToastItem, ToastType } from "@/components/ui/custom/ToastViewport";
import { ConfirmDialog } from "@/components/ui/custom/ConfirmDialog";

/** ========= Page ========= */
"""

with open(file_path, "r") as f:
    lines = f.readlines()

start_index = -1
for i, line in enumerate(lines):
    if "export default function Page" in line:
        start_index = i
        break

if start_index != -1:
    new_content = new_imports + "".join(lines[start_index:])
    with open(file_path, "w") as f:
        f.write(new_content)
    print("Successfully updated page.tsx")
else:
    print("Could not find 'export default function Page'")
