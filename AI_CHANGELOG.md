# AI Change Log (Frontend)

## Update Rules
- Append one entry after every frontend code change.
- Entry format:
  1. Date/Time
  2. Objective
  3. Files changed
  4. Validation commands and results
  5. Security notes
  6. Follow-up actions

## Entries

### 2026-03-07 23:42 (Asia/Singapore)
- Objective:
  - Split authenticated UI into two shells:
    - Employee: phone-first mobile shell
    - Admin: desktop-oriented shell
  - Route by role for easier maintenance.
- Files changed:
  - `src/App.jsx`
  - `src/components/Tabs.jsx`
  - `src/components/Tabs.css`
  - `src/layouts/AppBackground.jsx`
  - `src/layouts/AppBackground.css`
  - `src/layouts/EmployeeMobileShell.jsx`
  - `src/layouts/EmployeeMobileShell.css`
  - `src/layouts/AdminDesktopShell.jsx`
  - `src/layouts/AdminDesktopShell.css`
- Validation:
  - `npm run lint`: pass
  - `npm run build`: pass
- Security notes:
  - UI split does not change auth checks; role gating remains in app auth flow.
- Follow-up:
  - Verify employee UX on actual phone devices.
  - Consider lazy-loading heavy admin modules.

### 2026-03-07 23:50 (Asia/Singapore)
- Objective:
  - Run security checks after UI refactor.
- Files changed:
  - `AI_CHANGELOG.md`
- Validation:
  - `npm run lint`: pass
  - `npm run build`: pass
  - `npm audit`: failed due registry mirror endpoint limitation (advisories API not implemented)
- Security notes:
  - Backend repository still contains hardcoded DB credentials in committed config files.
- Follow-up:
  - Re-run npm audit with official npm registry or internal mirror that supports advisories.
  - Move backend connection strings into environment/secret manager.

### 2026-03-07 23:44 (Asia/Singapore)
- Objective:
  - Move Excel OT/report generation to backend.
  - Export workbook in 2 worksheets (`Details`, `Summary`) with visible formulas in summary cells.
- Files changed:
  - `src/screens/adminDashboard/AttendanceReport.jsx`
  - `../we-attendance-backend/Controllers/ReportsController.cs` (backend repo)
- Validation:
  - Frontend: `npm run lint` pass, `npm run build` pass.
  - Backend: `dotnet build` pass, `dotnet test` pass (20/20).
- Security notes:
  - Frontend no longer computes OT/pay formulas for export; reduces client-side logic tampering surface.
  - OT bucket numbers in export are from backend policy only.
- Follow-up:
  - If you want exact sample labels/rules for PH split or overnight split columns, confirm and we can adjust column mapping without touching OT policy core.

### 2026-03-07 23:52 (Asia/Singapore)
- Objective:
  - Separate `Overnight OT` into its own column in Excel export.
- Files changed:
  - `../we-attendance-backend/Controllers/ReportsController.cs`
- Validation:
  - Backend `dotnet build`: pass
  - Backend `dotnet test`: pass (20 passed)
- Security notes:
  - No auth or permission path changes.
- Follow-up:
  - Verify with a range containing overnight logs; `Details` and `Summary` now include dedicated `Overnight OT` columns.

### 2026-03-08 00:03 (Asia/Singapore)
- Objective:
  - Fix wrong `Start` / `End` times in attendance Excel export.
- Root cause:
  - Report used `ToSingaporeForReport` which interpreted DB timestamps as SG-local instead of UTC.
  - Attendance timestamps are stored in UTC, so times were shifted/misread in export.
- Files changed:
  - `../we-attendance-backend/Controllers/ReportsController.cs`
- Validation:
  - Backend `dotnet build`: pass
  - Backend `dotnet test`: pass (20 passed)
- Security notes:
  - No auth/permission change; timezone conversion correction only.

### 2026-03-08 00:16 (Asia/Singapore)
- Objective:
  - Improve report Start/End normalization and add formula-visible detail columns.
  - Add remark note in report (`စောတယ်`, `နောက်ကျတယ်`, `OT`, `ပုံမှန်`).
  - Recheck overnight OT presentation.
- Files changed:
  - `../we-attendance-backend/Controllers/ReportsController.cs`
- Implementation details:
  - Added peer-majority time alignment per day (same-day rows): outlier times near the majority are aligned.
  - Added 30-minute snapping for Start/End display.
  - `Details` sheet columns `Total Hours`, `Normal day OT`, `Saturday OT`, `Sunday OT`, `Overnight OT` are now formula cells.
  - Added `Remark` column.
- Validation:
  - Backend `dotnet build`: pass
  - Backend `dotnet test`: pass (20 passed)
- Security notes:
  - No auth model changes.

### 2026-03-08 00:25 (Asia/Singapore)
- Objective:
  - Correct OT formulas so `Normal day OT` is derived from `Total Hours - employee normal hours` with day checks.
- Files changed:
  - `../we-attendance-backend/Controllers/ReportsController.cs`
- Implementation:
  - Added employee schedule resolution (`EmployeeSchedule + WorkSchedule`) for per-day normal hours.
  - Details formulas:
    - `Total Hours` from Start/End
    - `Normal day OT` = IF(dayType=MONFRI, MAX(TotalHours-NormalHours,0), 0)
    - `Saturday OT` = IF(dayType=SAT, MAX(TotalHours-NormalHours,0), 0)
    - `Overnight OT` = IF(End<Start, MAX((End-00:30)*24,0), 0)
    - `Sunday OT` = IF(dayType=SUNPH, MAX(TotalHours-OvernightOT,0), 0)
  - DayType/NormalHours helper columns are hidden in Excel.
- Validation:
  - Backend `dotnet build`: pass
  - Backend `dotnet test`: pass (20 passed)

### 2026-03-08 00:33 (Asia/Singapore)
- Objective:
  - Enforce Saturday rule: normal working window is 08:00-13:00; OT starts after 13:00.
  - Use English-only remarks in report.
- Files changed:
  - `../we-attendance-backend/Controllers/ReportsController.cs`
- Implementation:
  - `ResolveNormalHours` Saturday fixed to `5.0`.
  - Details `Saturday OT` formula now computes from EndTime beyond `13:00` directly.
  - Remarks updated to `Early`, `Late`, `OT`, `Normal`.
- Validation:
  - Backend `dotnet build`: pass
  - Backend `dotnet test`: pass (20 passed)

### 2026-03-08 00:39 (Asia/Singapore)
- Objective:
  - Lock report formulas to fixed business rules provided by user.
- Files changed:
  - `../we-attendance-backend/Controllers/ReportsController.cs`
- Rule lock:
  - Mon-Fri normal = 8h
  - Saturday normal = 4h (08:00-13:00 with 1h lunch)
  - Sunday/PH normal = 0h
  - Total Hours = raw duration - 1h lunch (minimum 0)
  - Overnight OT starts after 00:00 (cross-midnight rows)
- Details formulas updated:
  - `Total Hours`, `Normal day OT`, `Saturday OT`, `Sunday OT`, `Overnight OT`
- Validation:
  - Backend `dotnet build`: pass
  - Backend `dotnet test`: pass (20 passed)

### 2026-03-08 01:02 (Asia/Singapore)
- Objective:
  - Verify and align frontend worker/admin dashboard values with report formula rules.
- Findings:
  - Mismatch existed: Admin summary and worker history used AttendancePolicy/log minutes, while report export used report-specific formulas.
- Fixes:
  - Backend `AdminDashboardController` now computes total/OT buckets using report-rule formulas:
    - TotalHours = raw - 1h lunch
    - Mon-Fri OT = max(Total-8,0)
    - Sat OT = max(Total-4,0)
    - Sun/PH OT = max(Total-Overnight,0)
    - Overnight = after 00:00 on cross-midnight rows
  - Frontend `HistoryScreen` now computes worker OT/worked minutes with same report-rule helper for overview/daily/list.
- Files changed:
  - `../we-attendance-backend/Controllers/AdminDashboardController.cs`
  - `src/screens/HistoryScreen.jsx`
- Validation:
  - Frontend `npm run lint`: pass
  - Frontend `npm run build`: pass
  - Backend `dotnet test`: pass (20 passed)

### 2026-03-08 01:25 (Asia/Singapore)
- Objective:
  - Restore admin desktop tab navigation between pages.
- Root cause:
  - Admin dashboard sticky section (`.we-admin-sticky`) used `top: 0`, which could overlap header tabs and intercept clicks.
  - Added explicit `type="button"` to tab buttons as a defensive fix.
- Files changed:
  - `src/layouts/AdminDesktopShell.jsx`
  - `src/layouts/AdminDesktopShell.css`
  - `src/screens/adminDashboard/styles/base.css`
- Implementation:
  - Admin header now stays above page content (`position: sticky; top: 0; z-index: 40`).
  - Admin content keeps lower stacking context.
  - Dashboard sticky section now sticks below shell header (`top: 84px`, mobile `72px`).
  - Admin tab buttons now explicitly use `type="button"`.
- Validation:
  - `npm run lint`: pass
  - `npm run build`: pass
- Security notes:
  - No authentication/session logic changed.

### 2026-03-08 01:48 (Asia/Singapore)
- Objective:
  - Use backend-calculated report OT values in History screen instead of frontend formulas.
- Files changed:
  - `src/screens/HistoryScreen.jsx`
  - `../we-attendance-backend/Controllers/AttendanceController.cs`
- Implementation:
  - Added backend report metric fields on attendance log DTO.
  - Replaced `HistoryScreen` local OT computation with backend metric aggregation.
  - Kept backend-field fallback (`regularMinutes` + `otMinutes`) for compatibility if report fields are absent.
- Validation:
  - `npm run lint`: pass
  - `npm run build`: pass
  - Backend `dotnet build`: pass
- Security notes:
  - Prevents UI-side overtime rule manipulation; display now trusts server-calculated values.

### 2026-03-08 02:06 (Asia/Singapore)
- Objective:
  - Make OT display clearer in History.
  - Split Settings into tabs to reduce leave section clutter.
- Files changed:
  - `src/screens/HistoryScreen.jsx`
  - `src/screens/SettingsScreen.jsx`
- Implementation:
  - Added OT bucket totals in History stats (`Mon-Fri`, `Sat`, `Sun/PH`).
  - Added per-session OT split row in History list.
  - Added Settings tab bar and conditional rendering for Account vs Leave content.
- Validation:
  - `npm run lint`: pass
  - `npm run build`: pass
- Security notes:
  - Presentation-layer update only.

### 2026-03-08 02:14 (Asia/Singapore)
- Objective:
  - Align History OT minute display with report-style OT rounding and remove odd minute tails.
- Files changed:
  - `src/screens/HistoryScreen.jsx`
- Implementation:
  - Added `roundOtMinutes` (30-minute block floor).
  - Rounded OT bucket totals in stats and per-session OT split before rendering.
- Validation:
  - `npm run lint`: pass
  - `npm run build`: pass
- Security notes:
  - Presentation logic only; no auth/data access change.

### 2026-03-08 02:22 (Asia/Singapore)
- Objective:
  - Clarify leave attachment storage location and align with backend fixed folder.
- Files changed:
  - `src/screens/SettingsScreen.jsx`
  - `../we-attendance-backend/Controllers/LeaveController.cs`
  - `../we-attendance-backend/Controllers/LeaveRequestsController.cs`
- Implementation:
  - Backend leave uploads now use `Documents/KJ_Attendance/leave_attachments`.
  - Legacy attachment lookup retained for old locations.
  - Settings UI hint updated with exact folder path.
- Validation:
  - `npm run lint`: pass
  - `npm run build`: pass
  - Backend build/test: pass
- Security notes:
  - No permission/auth flow changes.

### 2026-03-08 02:43 (Asia/Singapore)
- Objective:
  - Add Clock page calendar tab for work schedules and KPI-ready planning flow.
- Files changed:
  - `src/api/schedules.js`
  - `src/screens/ScheduleCalendarTab.jsx`
  - `src/screens/ClockScreen.jsx`
  - `src/screens/ClockScreen.css`
  - `src/layouts/EmployeeMobileShell.jsx`
  - `../we-attendance-backend/Controllers/SchedulesController.cs`
  - `../we-attendance-backend/Models/ScheduleChangeRequest.cs`
  - `../we-attendance-backend/Data/AppDbContext.cs`
  - `../we-attendance-backend/DbWarmupHostedService.cs`
- Implementation:
  - Clock screen now has segmented tabs: `Clock` and `Calendar`.
  - New Calendar tab shows date-range schedule rows and role-specific actions.
  - Admin can create default schedule, assign schedule, and approve/reject supervisor requests.
  - Supervisor can submit schedule-change requests.
  - Worker remains read-only (calendar viewing only).
- Validation:
  - `npm run lint`: pass
  - `npm run build`: pass
  - Backend build/test: pass
- Adjustment:
  - Added admin desktop `Calendar` tab entry point for schedule workflow.
  - File: `src/layouts/AdminDesktopShell.jsx`

### 2026-03-08 03:01 (Asia/Singapore)
- Objective:
  - Redesign calendar to month grid and enable day-click schedule entry UX.
- Files changed:
  - `src/screens/ScheduleCalendarTab.jsx`
  - `src/screens/ClockScreen.css`
  - `src/api/schedules.js`
  - `../we-attendance-backend/Controllers/SchedulesController.cs`
  - `../we-attendance-backend/Models/WorkScheduleEntry.cs`
  - `../we-attendance-backend/Data/AppDbContext.cs`
  - `../we-attendance-backend/DbWarmupHostedService.cs`
- Implementation:
  - Apple-style month calendar grid (42-cell layout) with entry badges and quick chips.
  - Day panel lists all entries for selected day.
  - Admin add form supports multiple entries/day and stores worker + location + work title + note.
  - API integration switched to new date-specific schedule entry endpoints.
- Validation:
  - `npm run lint`: pass
  - `npm run build`: pass
  - Backend build/tests: pass

### 2026-03-08 03:12 (Asia/Singapore)
- Objective:
  - Allow assigning one daily schedule to multiple workers at once.
- Files changed:
  - `src/screens/ScheduleCalendarTab.jsx`
  - `src/api/schedules.js`
  - `src/screens/ClockScreen.css`
  - `../we-attendance-backend/Controllers/SchedulesController.cs`
- Implementation:
  - Replaced single-worker selector with multi-worker checkbox list.
  - Added bulk-create API integration (`entries/bulk`).
