<!-- Static visual approximation of the Prezl IDE shell, used as the home-page
     hero image. Not a live editor — just colored spans inside a styled frame
     so the home page shows the kind of output the reader will get. -->
<template>
  <div class="prezl-hero">
    <!-- TopBar -->
    <div class="pz-titlebar">
      <div class="pz-tile">P</div>
      <div class="pz-title">Umbraco Dashboard Demo</div>
      <div class="pz-sep" />
      <div class="pz-branch">⎇ feature/dashboard-shell</div>
      <div class="pz-spacer" />
      <div class="pz-run">▶ Run</div>
      <div class="pz-winbtn" />
      <div class="pz-winbtn" />
      <div class="pz-winbtn close" />
    </div>

    <div class="pz-body">
      <!-- Explorer -->
      <div class="pz-explorer">
        <div class="pz-group-header">
          <span class="pz-chev">▾</span>
          <span class="pz-glyph">TS</span>
          <span class="pz-groupname">Frontend</span>
        </div>
        <ul class="pz-files">
          <li><span class="pz-chev">▾</span><span class="pz-folder">📁</span> src</li>
          <li class="indent"><span class="pz-file icon-code-blue">◈</span> main.ts</li>
          <li class="indent active"><span class="pz-file icon-code-blue">◈</span> dashboard.ts</li>
          <li class="indent"><span class="pz-file icon-code-blue">◈</span> api.ts</li>
          <li class="indent"><span class="pz-file icon-code-blue">◈</span> framework.ts</li>
        </ul>
      </div>

      <!-- Editor -->
      <div class="pz-editor">
        <div class="pz-tabs">
          <div class="pz-tab active">dashboard.ts</div>
          <div class="pz-tab">main.ts</div>
        </div>
        <div class="pz-code">
          <div class="pz-line focus"><span class="ln">10</span><span class="kw">export</span> <span class="kw">function</span> <span class="fn">registerDashboard</span>(<span class="var">app</span>: <span class="type">App</span>) <span class="punct">{</span></div>
          <div class="pz-line focus"><span class="ln">11</span>  <span class="kw">const</span> <span class="var">dashboard</span> = <span class="fn">createDashboard</span>()</div>
          <div class="pz-line focus"><span class="ln">12</span>  <span class="var">dashboard</span>.<span class="fn">register</span>(<span class="var">app</span>)</div>
          <div class="pz-line"><span class="ln">13</span><span class="punct">}</span></div>
          <div class="pz-line"><span class="ln">14</span></div>
          <div class="pz-line collapsed"><span class="ln">15</span><span class="chev-sq">+</span><span class="dim">…</span></div>
          <div class="pz-line"><span class="ln">24</span><span class="punct">}</span></div>
        </div>
      </div>
    </div>

    <!-- StatusBar -->
    <div class="pz-statusbar">
      <span>⎇ feature/dashboard-shell</span>
      <span class="dim">typescript</span>
      <span class="pz-spacer" />
      <span class="dim">Ready</span>
    </div>
  </div>
</template>

<style scoped>
.pz-titlebar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #1e1e22;
  border-bottom: 1px solid rgba(148, 163, 184, 0.08);
  padding: 0 8px;
  height: 32px;
  font-size: 11px;
}
.pz-tile {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: rgba(99, 102, 241, 0.22);
  color: #a5b4fc;
  font-weight: 700;
  font-size: 10px;
}
.pz-title { font-weight: 600; color: #e4e4e7; }
.pz-sep { width: 1px; height: 14px; background: rgba(148, 163, 184, 0.2); margin: 0 2px; }
.pz-branch { color: #a1a1aa; }
.pz-spacer { flex: 1; }
.pz-run {
  background: #27272a;
  color: #e4e4e7;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  border: 1px solid rgba(148, 163, 184, 0.14);
}
.pz-winbtn { width: 10px; height: 10px; border-radius: 50%; background: #52525b; margin-left: 4px; }
.pz-winbtn.close { background: #ef4444; }

.pz-body { display: grid; grid-template-columns: 170px 1fr; min-height: 0; height: calc(100% - 32px - 18px); }

.pz-explorer {
  background: #1e1e22;
  padding: 4px 0;
  border-right: 1px solid rgba(148, 163, 184, 0.08);
  overflow: hidden;
}
.pz-group-header {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 4px 6px;
  border-left: 2px solid #818cf8;
  background: rgba(129, 140, 248, 0.05);
}
.pz-chev { color: #a1a1aa; width: 10px; display: inline-block; text-align: center; font-size: 10px; }
.pz-glyph {
  display: inline-block;
  width: 18px;
  height: 14px;
  background: rgba(129, 140, 248, 0.22);
  color: #a5b4fc;
  font-size: 9px;
  font-weight: 700;
  text-align: center;
  line-height: 14px;
  border-radius: 2px;
}
.pz-groupname { color: #e4e4e7; font-weight: 600; }
.pz-files { list-style: none; padding: 2px 0 0; margin: 0; }
.pz-files li {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 3px 8px;
  color: #a1a1aa;
  font-size: 11px;
}
.pz-files li.indent { padding-left: 22px; }
.pz-files li.active { background: rgba(255, 255, 255, 0.04); color: #e4e4e7; }
.pz-folder { color: #a1a1aa; }
.pz-file { display: inline-block; width: 12px; }
.icon-code-blue { color: #60a5fa; }

.pz-editor { display: flex; flex-direction: column; background: #1a1a1e; min-height: 0; }
.pz-tabs { display: flex; border-bottom: 1px solid rgba(148, 163, 184, 0.08); }
.pz-tab {
  padding: 6px 12px;
  font-size: 11px;
  color: #a1a1aa;
  border-right: 1px solid rgba(148, 163, 184, 0.08);
}
.pz-tab.active { background: #27272a; color: #e4e4e7; }

.pz-code { padding: 6px 0; overflow: hidden; }
.pz-line { display: flex; padding: 1px 0; color: #e4e4e7; white-space: nowrap; }
.pz-line .ln {
  display: inline-block;
  width: 28px;
  text-align: right;
  padding-right: 10px;
  color: #52525b;
  user-select: none;
}
.pz-line.focus { background: rgba(250, 204, 21, 0.07); }
.pz-line.focus .ln { border-left: 2px solid #eab308; padding-left: 0; margin-left: -2px; }
.pz-line.collapsed { color: #52525b; }
.pz-line.collapsed .chev-sq {
  display: inline-grid;
  place-items: center;
  width: 11px;
  height: 11px;
  border: 1px solid #52525b;
  border-radius: 2px;
  margin-right: 8px;
  font-size: 9px;
  line-height: 1;
  color: #71717a;
}
.dim { color: #71717a; }
.kw { color: #c084fc; }
.fn { color: #60a5fa; }
.var { color: #e4e4e7; }
.type { color: #5eead4; }
.punct { color: #a1a1aa; }

.pz-statusbar {
  display: flex;
  gap: 10px;
  align-items: center;
  background: #1e1e22;
  border-top: 1px solid rgba(148, 163, 184, 0.08);
  padding: 0 8px;
  height: 18px;
  font-size: 10px;
  color: #a1a1aa;
}
</style>
