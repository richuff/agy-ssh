/**
 * agy-ssh — Antigravity 中的 SSH 管理面板
 */
(() => {
  if (window.__agy_ssh_cleanup) {
    try { window.__agy_ssh_cleanup(); } catch (e) {}
  }
  const ROOT_ID = "__agy_ssh_root__";
  const ITEM_ID = "__agy_ssh_item__";
  const API = "http://127.0.0.1:18761";

  const style = document.createElement("style");
  style.id = "__agy_ssh_style__";
  style.textContent = `
  #${ITEM_ID}{display:flex}
  #${ITEM_ID} .agy-ic{width:16px;height:16px;flex:0 0 16px;opacity:.8}

  #${ROOT_ID}{
    --surface:#fff;--sidebar:#f5f8f8;--hover:#eaf0f0;--border:#d4dfdf;
    --text:#162a2d;--muted:#53686c;--accent:#096d68;--selected:#def1ee;--on-accent:#fff;
    --success:#176846;--danger:#a82b35;--warning:#7d500f;--warning-bg:#fff6e3;
    --scrim:rgba(16,22,33,.45);--shadow:rgba(16,22,33,.24);
    --term-bg:#0c1017;--term-bar:#161b22;--term-border:#30363d;
    --term-text:#e6edf3;--term-muted:#8b949e;--term-green:#3fb950;
    --term-blue:#58a6ff;--term-yellow:#d29922;--term-cyan:#39c5cf;
    --term-magenta:#bc8cff;--term-red:#f85149;--term-white:#f0f6fc;
    --sans:system-ui,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
    --mono:'Cascadia Code','Fira Code','JetBrains Mono','Ubuntu Mono','Menlo',Consolas,monospace;
    color-scheme:light;
  }
  :is(.theme-dark,.vscode-dark) #${ROOT_ID}{
    --surface:#202b30;--sidebar:#192428;--hover:#2d3c41;--border:#405157;
    --text:#e8f1f0;--muted:#acbfc2;--accent:#8edacb;--selected:#223f40;--on-accent:#103531;
    --success:#8ddab2;--danger:#ffabb1;--warning:#f2c679;--warning-bg:#372d23;
    --scrim:rgba(5,9,15,.66);--shadow:rgba(5,9,15,.4);
    --term-bg:#0c1017;--term-bar:#161b22;--term-border:#30363d;
    color-scheme:dark;
  }
  #${ROOT_ID} *,
  #${ROOT_ID} *::before,
  #${ROOT_ID} *::after{box-sizing:border-box}
  #${ROOT_ID} [hidden]{display:none!important}
  #${ROOT_ID} form{margin:0}
  #${ROOT_ID} :is(button,summary,select,input):focus-visible{
    outline:2px solid var(--accent);outline-offset:2px;
  }
  #${ROOT_ID} .as-panel,
  #${ROOT_ID} .as-dialog{
    margin:auto;padding:0;max-width:none;max-height:none;border:0;border-radius:12px;
    background:var(--surface);color:var(--text);font:13px/1.5 var(--sans);
    box-shadow:0 16px 48px var(--shadow);
  }
  #${ROOT_ID} .as-panel{
    width:min(1456px,calc(100% - 40px));height:min(1014px,calc(100% - 40px));overflow:hidden;
  }
  #${ROOT_ID} .as-panel[open]{display:flex;flex-direction:column}
  #${ROOT_ID} .as-panel::backdrop,
  #${ROOT_ID} .as-dialog::backdrop{background:var(--scrim)}
  #${ROOT_ID} .as-top,
  #${ROOT_ID} .as-sidebar-head,
  #${ROOT_ID} .as-workspace-head,
  #${ROOT_ID} .as-terminal-footer{
    display:flex;align-items:center;justify-content:space-between;gap:12px;
  }
  #${ROOT_ID} .as-top{
    min-height:56px;padding:10px 16px 10px 20px;border-bottom:1px solid var(--border);
  }
  #${ROOT_ID} :is(h2,h3,p){margin:0}
  #${ROOT_ID} .as-top h2,
  #${ROOT_ID} .as-dialog h2{font-size:16px;font-weight:650}
  #${ROOT_ID} .as-top h2{display:flex;align-items:center;gap:10px}
  #${ROOT_ID} .as-brand-icon{
    display:grid;place-items:center;width:30px;height:30px;border-radius:8px;background:var(--selected);color:var(--accent);
  }
  #${ROOT_ID} .as-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px;min-width:0}
  #${ROOT_ID} .as-service{color:var(--muted);font-size:12px}
  #${ROOT_ID} .as-service[data-error]{color:var(--danger)}
  #${ROOT_ID} .as-btn,
  #${ROOT_ID} .as-select,
  #${ROOT_ID} .as-field input{
    min-height:32px;margin:0;border:1px solid var(--border);border-radius:6px;
    background:var(--surface);color:var(--text);font:inherit;
  }
  #${ROOT_ID} .as-btn{
    display:inline-flex;align-items:center;justify-content:center;gap:5px;
    padding:4px 10px;white-space:nowrap;cursor:pointer;
  }
  #${ROOT_ID} .as-btn:hover:not(:disabled){background:var(--hover)}
  #${ROOT_ID} .as-btn:active:not(:disabled){background:var(--selected)}
  #${ROOT_ID} .as-btn:disabled,
  #${ROOT_ID} .as-select:disabled{opacity:.56;cursor:default}
  #${ROOT_ID} .as-btn.as-quiet{background:transparent;border-color:transparent}
  #${ROOT_ID} .as-btn.as-quiet:hover:not(:disabled){background:var(--hover)}
  #${ROOT_ID} .as-btn.as-primary{
    color:var(--on-accent);background:var(--accent);border-color:transparent;font-weight:600;
  }
  #${ROOT_ID} .as-btn.as-primary:hover:not(:disabled){background:var(--accent);filter:brightness(.9)}
  #${ROOT_ID} .as-btn.as-danger{color:var(--danger)}
  #${ROOT_ID} .as-btn.as-icon-button{width:32px;padding:0}
  #${ROOT_ID} .as-icon{width:16px;height:16px;flex:none}

  #${ROOT_ID} .as-body{
    flex:1;min-height:0;display:grid;grid-template-columns:248px minmax(0,1fr);
  }
  #${ROOT_ID} .as-sidebar{
    display:flex;flex-direction:column;min-width:0;min-height:0;
    border-right:1px solid var(--border);background:var(--sidebar);
  }
  #${ROOT_ID} .as-sidebar-head{min-height:56px;padding:10px 12px 8px 20px}
  #${ROOT_ID} .as-sidebar-head h3{display:flex;align-items:baseline;gap:7px;font-size:14px;font-weight:650}
  #${ROOT_ID} .as-count{color:var(--muted);font:12px var(--mono)}
  #${ROOT_ID} .as-filter{
    display:flex;align-items:center;gap:8px;margin:0 12px 8px;padding:0 10px;
    min-height:34px;border:1px solid var(--border);border-radius:7px;background:var(--surface);color:var(--muted);
    outline:none;
  }
  #${ROOT_ID} .as-filter:focus,
  #${ROOT_ID} .as-filter:focus-within{border-color:var(--accent);outline:none!important}
  #${ROOT_ID} .as-filter input{
    width:100%;min-width:0;border:0;outline:none!important;background:transparent;color:var(--text);font:inherit;
    box-shadow:none!important;-webkit-appearance:none;
  }
  #${ROOT_ID} .as-filter input:focus,
  #${ROOT_ID} .as-filter input:focus-visible,
  body[data-agy-theme] #${ROOT_ID} .as-filter input:focus,
  body[data-agy-theme] #${ROOT_ID} .as-filter input:focus-visible{
    outline:none!important;box-shadow:none!important;border:none!important;
  }
  #${ROOT_ID} .as-filter input::placeholder{color:var(--muted)}
  #${ROOT_ID} .as-servers{overflow:auto;overscroll-behavior:contain;padding:0 10px 12px}
  #${ROOT_ID} :is(.as-servers,.as-output,.as-history-list){scrollbar-width:thin}
  #${ROOT_ID} .as-group{margin:8px 0 4px;padding-inline:10px;color:var(--muted);font-size:12px}
  #${ROOT_ID} .as-server{
    width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;
    padding:7px 10px;margin:0 0 2px;border:0;border-radius:6px;background:transparent;
    color:var(--text);font:inherit;text-align:left;cursor:pointer;
  }
  #${ROOT_ID} .as-server:hover{background:var(--hover)}
  #${ROOT_ID} .as-server[aria-pressed="true"]{background:var(--selected);color:var(--accent)}
  #${ROOT_ID} .as-server:focus-visible{outline-offset:-2px}
  #${ROOT_ID} .as-server-name,
  #${ROOT_ID} .as-server-address,
  #${ROOT_ID} .as-workspace-name,
  #${ROOT_ID} .as-address{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #${ROOT_ID} .as-server-name{font-weight:600}
  #${ROOT_ID} .as-server-address,
  #${ROOT_ID} .as-address{color:var(--muted);font:12px/1.5 var(--mono)}
  #${ROOT_ID} .as-server-state{width:8px;height:8px;border-radius:50%;background:currentColor}
  #${ROOT_ID} .as-server-state[data-state="ok"]{color:var(--success)}
  #${ROOT_ID} .as-server-state[data-state="failed"]{color:var(--danger)}
  #${ROOT_ID} .as-server-state[data-state="testing"]{color:var(--warning)}
  #${ROOT_ID} .as-empty{padding:10px;color:var(--muted);overflow-wrap:anywhere}
  #${ROOT_ID} .as-empty strong{display:block;color:var(--text);font-weight:600}

  #${ROOT_ID} .as-workspace{
    display:flex;flex-direction:column;gap:12px;min-width:0;min-height:0;padding:16px;
  }
  #${ROOT_ID} .as-workspace-head{flex-wrap:wrap}
  #${ROOT_ID} .as-target{flex:1 1 180px;min-width:0}
  #${ROOT_ID} .as-workspace-name{font-size:18px;font-weight:650}
  #${ROOT_ID} .as-console-head{
    display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 14px;
    border-bottom:1px solid var(--terminal-border);color:var(--terminal-muted);font:12px/1.5 var(--sans);
  }
  #${ROOT_ID} .as-console-head strong{font-weight:600;color:var(--terminal-text)}
  #${ROOT_ID} [data-status][data-state="ok"]{color:var(--terminal-success)}
  #${ROOT_ID} [data-status][data-state="failed"]{color:var(--terminal-error)}
  #${ROOT_ID} .as-warning{
    display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px;padding:8px 10px;
    border-radius:6px;background:var(--warning-bg);color:var(--warning);
  }
  #${ROOT_ID} .as-warning button{color:inherit}
  #${ROOT_ID} .as-credential-offer{
    display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px 12px;
    padding:9px 10px;border:1px solid var(--border);border-radius:6px;background:var(--sidebar);
  }
  #${ROOT_ID} .as-credential-offer strong{display:block;font-weight:600}
  #${ROOT_ID} .as-terminal{
    display:flex;flex:1;flex-direction:column;min-width:0;min-height:0;
    border:1px solid var(--term-border);border-radius:8px;background:var(--term-bg);
    color-scheme:dark;color:var(--term-text);font:13px/1.55 var(--mono);
    box-shadow:inset 0 1px 4px rgba(0,0,0,.4);
  }
  #${ROOT_ID} .as-console-head{
    display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 14px;
    background:var(--term-bar);border-bottom:1px solid var(--term-border);
    color:var(--term-muted);font:12px/1.4 var(--sans);
  }
  #${ROOT_ID} .as-console-title-group{display:flex;align-items:center;gap:8px}
  #${ROOT_ID} .as-term-dot-badge{color:var(--term-green);font-size:10px;display:inline-block}
  #${ROOT_ID} .as-console-title-group strong{font-weight:600;color:var(--term-text);font-family:var(--mono)}
  #${ROOT_ID} .as-term-cwd-badge{
    font:11px/1 var(--mono);padding:2px 6px;border-radius:4px;
    background:rgba(88,166,255,.15);color:var(--term-blue);border:1px solid rgba(88,166,255,.25);
  }
  #${ROOT_ID} .as-console-meta{display:flex;align-items:center;gap:8px}
  #${ROOT_ID} .as-term-clear-btn{
    font-size:11px;padding:2px 8px;height:24px;min-height:24px;color:var(--term-muted);
  }
  #${ROOT_ID} .as-term-clear-btn:hover{color:var(--term-text);background:rgba(255,255,255,.08)}
  #${ROOT_ID} .as-output{
    flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;
    padding:8px 12px;user-select:text;
    background:var(--term-bg);color:var(--term-text);
  }
  #${ROOT_ID} .as-term-welcome{
    padding:6px 8px 8px;margin-bottom:4px;border-bottom:1px dashed var(--term-border);
    color:var(--term-muted);font-size:12px;line-height:1.45;
  }
  #${ROOT_ID} .as-term-welcome-title{color:var(--term-text);font-size:13px;margin-bottom:2px}
  #${ROOT_ID} .as-term-welcome-desc{color:var(--term-muted)}
  #${ROOT_ID} .as-log-entry{margin:0 0 2px}
  #${ROOT_ID} .as-log-prompt-line{
    display:flex;align-items:baseline;flex-wrap:wrap;margin:0;line-height:1.45;
  }
  #${ROOT_ID} .as-prompt{
    display:inline-flex;align-items:baseline;white-space:nowrap;user-select:none;font-weight:500;
  }
  #${ROOT_ID} .as-p-user{color:var(--term-green);font-weight:600}
  #${ROOT_ID} .as-p-sep{color:var(--term-text);opacity:.7}
  #${ROOT_ID} .as-p-path{color:var(--term-blue);font-weight:600}
  #${ROOT_ID} .as-p-char{color:var(--term-white);margin-left:2px;margin-right:8px}
  #${ROOT_ID} .as-log-cmd{color:var(--term-white);font-weight:500;overflow-wrap:anywhere}
  #${ROOT_ID} .as-log-meta{display:inline-flex;align-items:center;gap:6px;margin-left:auto;font-size:11px;user-select:none}
  #${ROOT_ID} .as-badge-mcp{
    font:10px/1.2 var(--sans);padding:1px 6px;border-radius:3px;
    background:rgba(188,140,255,.2);color:var(--term-magenta);border:1px solid rgba(188,140,255,.35);
  }
  #${ROOT_ID} .as-log-time{color:var(--term-muted);font-size:11px}
  #${ROOT_ID} .as-log-exit{color:var(--term-red);font-weight:600}
  #${ROOT_ID} .as-log-stdout{
    color:var(--term-text);line-height:1.45;white-space:pre-wrap;word-break:break-all;margin:0;
  }
  #${ROOT_ID} .as-log-stderr{
    color:var(--term-red);line-height:1.45;white-space:pre-wrap;word-break:break-all;margin:0;
  }
  #${ROOT_ID} .as-command{
    display:flex;align-items:center;gap:0;padding:6px 10px 6px 14px;
    background:var(--term-bar);border-top:1px solid var(--term-border);
    border-radius:0 0 7px 7px;
  }
  #${ROOT_ID} .as-command:focus-within{border-top-color:var(--term-green)}
  #${ROOT_ID} .as-cmd-input{
    flex:1;min-width:0;height:30px;padding:0 2px;border:0;outline:none!important;background:transparent;
    color:var(--term-white);font:inherit;caret-color:var(--term-green);box-shadow:none!important;
  }
  #${ROOT_ID} .as-cmd-input:focus,
  #${ROOT_ID} .as-cmd-input:focus-visible,
  body[data-agy-theme] #${ROOT_ID} .as-cmd-input:focus,
  body[data-agy-theme] #${ROOT_ID} .as-cmd-input:focus-visible{
    outline:none!important;box-shadow:none!important;border:none!important;
  }
  #${ROOT_ID} .as-cmd-input::placeholder{color:var(--term-muted);opacity:1}
  #${ROOT_ID} .as-command .as-btn{font:600 13px var(--sans)}
  #${ROOT_ID} .as-output::selection,
  #${ROOT_ID} .as-output *::selection{color:var(--term-white);background:#264f78}
  #${ROOT_ID} .as-terminal-footer{position:relative;color:var(--muted);font-size:12px;min-height:32px}
  #${ROOT_ID} .as-terminal-footer > .as-actions{margin-left:auto}
  #${ROOT_ID} .as-history summary{list-style:none}
  #${ROOT_ID} .as-history summary::-webkit-details-marker{display:none}
  #${ROOT_ID} .as-history[open] summary{background:var(--selected)}
  #${ROOT_ID} .as-history-list{
    position:absolute;z-index:1;right:0;bottom:calc(100% + 8px);
    width:min(360px,calc(100vw - 54px));max-height:min(240px,34vh);overflow:auto;
    padding:6px;border:1px solid var(--border);border-radius:8px;background:var(--surface);
  }
  #${ROOT_ID} .as-history-list button{
    display:block;width:100%;border:0;border-radius:4px;padding:7px 8px;
    color:var(--text);background:transparent;font:12px/1.5 var(--mono);
    text-align:left;overflow-wrap:anywhere;cursor:pointer;
  }
  #${ROOT_ID} .as-history-list button:hover{background:var(--hover)}
  #${ROOT_ID} .as-history-list button:focus-visible{outline-offset:-2px}

  #${ROOT_ID} .as-dialog{
    width:min(448px,calc(100% - 28px));max-height:calc(100% - 28px);overflow:auto;
  }
  #${ROOT_ID} .as-form h2{padding:17px 22px;border-bottom:1px solid var(--border);font-size:17px}
  #${ROOT_ID} [data-dlg-body]{padding:18px 22px 0}
  #${ROOT_ID} .as-field{display:grid;gap:4px;min-width:0;margin-bottom:12px;font-weight:600}
  #${ROOT_ID} .as-field input{
    width:100%;min-height:36px;padding:7px 10px;font-weight:400;outline:none;box-shadow:none;
  }
  #${ROOT_ID} .as-field input:focus,
  #${ROOT_ID} .as-field input:focus-visible,
  body[data-agy-theme] #${ROOT_ID} .as-field input:focus,
  body[data-agy-theme] #${ROOT_ID} .as-field input:focus-visible{
    border-color:var(--accent)!important;outline:none!important;box-shadow:none!important;
  }
  #${ROOT_ID} .as-password-entry{display:flex;gap:8px}
  #${ROOT_ID} .as-password-entry input{min-width:0}
  #${ROOT_ID} .as-select{width:100%;min-height:36px;padding:6px 10px;color:var(--text);font-weight:400;cursor:pointer}
  @supports (appearance:base-select){
    #${ROOT_ID} .as-select,#${ROOT_ID} .as-select::picker(select){appearance:base-select}
    #${ROOT_ID} .as-select::picker(select){
      margin-block:4px;padding:4px;border:1px solid var(--border);border-radius:8px;
      background:var(--surface);color:var(--text);box-shadow:0 7px 20px var(--shadow);
    }
    #${ROOT_ID} .as-select::picker-icon{color:var(--muted)}
    #${ROOT_ID} .as-select option{padding:7px 9px;border-radius:5px;font:13px/1.5 var(--sans)}
    #${ROOT_ID} .as-select option:checked{background:var(--selected);color:var(--accent)}
    #${ROOT_ID} .as-select option:hover{background:var(--hover)}
  }
  #${ROOT_ID} .as-user-control{
    display:flex;align-items:center;gap:8px;padding:0 4px 0 11px;border:1px solid var(--border);
    border-radius:7px;color:var(--muted);background:var(--surface);anchor-name:--agy-ssh-user;
    outline:none;
  }
  #${ROOT_ID} .as-user-control:focus,
  #${ROOT_ID} .as-user-control:focus-within{border-color:var(--accent);outline:none!important}
  #${ROOT_ID} .as-user-control input{
    flex:1;min-width:0;border:0;outline:none!important;background:transparent;padding:7px 0;
    box-shadow:none!important;-webkit-appearance:none;
  }
  #${ROOT_ID} .as-user-control input:focus,
  #${ROOT_ID} .as-user-control input:focus-visible,
  body[data-agy-theme] #${ROOT_ID} .as-user-control input:focus,
  body[data-agy-theme] #${ROOT_ID} .as-user-control input:focus-visible{
    outline:none!important;box-shadow:none!important;border:none!important;
  }
  #${ROOT_ID} .as-user-control button[aria-expanded=true]{color:var(--accent);background:var(--selected)}
  #${ROOT_ID} .as-user-control button[aria-expanded=true] svg{transform:rotate(180deg)}
  #${ROOT_ID} .as-user-options{
    inset:auto;margin:5px 0;position:fixed;position-anchor:--agy-ssh-user;top:anchor(bottom);left:anchor(left);
    width:anchor-size(width);position-try-fallbacks:flip-block;max-height:min(180px,30vh);overflow:auto;
    padding:5px;border:1px solid var(--border);border-radius:9px;background:var(--surface);
    color:var(--text);font:13px/1.5 var(--sans);box-shadow:0 7px 20px var(--shadow);
  }
  #${ROOT_ID} .as-user-option{
    display:flex;align-items:center;gap:9px;min-height:36px;padding:6px 10px;border-radius:5px;cursor:pointer;
  }
  #${ROOT_ID} .as-user-option span{flex:1;overflow-wrap:anywhere;font-family:var(--mono)}
  #${ROOT_ID} .as-user-option:hover,#${ROOT_ID} .as-user-option[data-active]{background:var(--hover)}
  #${ROOT_ID} .as-user-option[aria-selected=true]{color:var(--accent);background:var(--selected)}
  #${ROOT_ID} .as-field input::placeholder{color:var(--muted);opacity:1}
  #${ROOT_ID} .as-field-row{display:grid;grid-template-columns:minmax(0,2fr) minmax(70px,1fr);gap:12px}
  #${ROOT_ID} [data-server-user]{padding-top:14px;border-top:1px solid var(--border)}
  #${ROOT_ID} .as-hint{color:var(--muted);font-size:12px;font-weight:400}
  #${ROOT_ID} .as-dlg-error{color:var(--danger);margin:12px 22px 0}
  #${ROOT_ID} .as-dlg-actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px;margin-top:16px;padding:12px 22px;border-top:1px solid var(--border);background:var(--sidebar)}
  #${ROOT_ID} .as-dlg-actions [data-delete-server]{margin-right:auto}
  #${ROOT_ID} .as-cred-row{
    display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);
  }
  #${ROOT_ID} .as-cred-row:first-child{margin-top:8px}
  #${ROOT_ID} .as-cred-identity{flex:1 1 110px;min-width:0;overflow-wrap:anywhere}
  #${ROOT_ID} .as-cred-identity strong{display:block}
  #${ROOT_ID} .as-add-cred{margin-top:12px}

  @media (max-width:720px){
    #${ROOT_ID} .as-panel{width:calc(100% - 16px);height:calc(100% - 16px)}
    #${ROOT_ID} .as-top{min-height:48px;padding:7px 10px 7px 14px}
    #${ROOT_ID} .as-top .as-actions{justify-content:flex-end;gap:4px}
    #${ROOT_ID} .as-body{grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr)}
    #${ROOT_ID} .as-sidebar{max-height:31vh;border-right:0;border-bottom:1px solid var(--border)}
    #${ROOT_ID} .as-sidebar-head{min-height:44px;padding:6px 10px 5px 14px}
    #${ROOT_ID} .as-servers{padding-bottom:6px}
    #${ROOT_ID} .as-workspace{padding:10px;gap:8px}
    #${ROOT_ID} .as-workspace-head{gap:6px 12px}
    #${ROOT_ID} .as-command{gap:6px;padding-inline:8px}
    #${ROOT_ID} .as-output{padding:10px}
  }
  @media (max-height:500px){
    #${ROOT_ID} .as-body{overflow-y:auto}
    #${ROOT_ID} .as-workspace{min-height:310px}
  }
  `;
  const existingStyle = document.getElementById("__agy_ssh_style__");
  if (existingStyle) {
    existingStyle.textContent = style.textContent;
  } else {
    document.head.appendChild(style);
  }

  const PANEL_VERSION = "20261124-v3";
  const existingRoot = document.getElementById(ROOT_ID);
  let wasModalOpen = false;
  if (existingRoot) {
    if (existingRoot.dataset.version === PANEL_VERSION) {
      document.querySelectorAll(`#${ROOT_ID} input`).forEach((i) => i.classList.add("no-focus-ring"));
      window.__agy_ssh_ver = PANEL_VERSION;
      return "already-injected";
    }
    wasModalOpen = existingRoot.querySelector(".as-panel")?.hasAttribute("open") || false;
    existingRoot.remove();
    document.getElementById(ITEM_ID)?.remove();
  }

  const icons = {
    terminal: '<path d="m4 6 6 6-6 6m9 0h7"/>',
    search: '<circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5"/>',
    user: '<circle cx="12" cy="8" r="3.5"/><path d="M4.5 21v-2a7.5 7.5 0 0 1 15 0v2"/>',
    key: '<circle cx="8" cy="9" r="4"/><path d="m11 12 8 8 2-2-2-2 1-1"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    check: '<path d="m4.5 12 5 5 10-10"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    history: '<path d="M3 12a9 9 0 1 1 2.6 6.4M3 5v7h7m2-4v4l3 2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M10 3h4l.5 2.4 1.6.9 2.3-.8 2 3.5-1.8 1.6v1.8l1.8 1.6-2 3.5-2.3-.8-1.6.9L14 20h-4l-.5-2.4-1.6-.9-2.3.8-2-3.5 1.8-1.6v-1.8L3.6 9l2-3.5 2.3.8 1.6-.9z"/>',
  };
  const icon = (name) => `<svg class="as-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`;

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.dataset.version = PANEL_VERSION;
  root.innerHTML = `
    <dialog class="as-panel" data-panel aria-labelledby="agy-ssh-title">
      <header class="as-top">
        <h2 id="agy-ssh-title"><span class="as-brand-icon">${icon("terminal")}</span>SSH 管理</h2>
        <div class="as-actions">
          <span class="as-service" data-api role="status" hidden></span>
          <button class="as-btn as-quiet" type="button" data-refresh>刷新</button>
          <button class="as-btn as-quiet as-icon-button" type="button" data-close aria-label="关闭 SSH 管理" autofocus>${icon("close")}</button>
        </div>
      </header>
      <div class="as-body">
        <section class="as-sidebar" aria-labelledby="agy-ssh-servers">
          <header class="as-sidebar-head">
            <h3 id="agy-ssh-servers">服务器 <span class="as-count" data-count></span></h3>
            <button class="as-btn" type="button" data-add-srv aria-label="添加服务器">${icon("plus")}添加</button>
          </header>
          <label class="as-filter" data-filter hidden>${icon("search")}<input type="search" class="no-focus-ring" data-search
            aria-label="按名称、地址或分组搜索服务器" placeholder="搜索服务器" autocomplete="off"></label>
          <div class="as-servers" data-srvlist></div>
        </section>
        <section class="as-workspace" aria-labelledby="agy-ssh-target">
          <header class="as-workspace-head">
            <div class="as-target">
              <h3 class="as-workspace-name" id="agy-ssh-target" data-host></h3>
              <span class="as-address" data-address hidden></span>
            </div>
            <div class="as-actions" data-server-actions hidden>
              <button class="as-btn" type="button" data-edit aria-label="编辑服务器">编辑</button>
            </div>
          </header>
          <div class="as-warning" data-host-key hidden>
            <span>主机指纹验证失败。确认指纹变更后再更新。</span>
            <button class="as-btn" type="button" data-update-key>更新主机指纹</button>
          </div>
          <div class="as-credential-offer" data-credential-offer aria-label="保存登录凭据" role="group" hidden>
            <div>
              <strong>连接成功。保存这组登录凭据？</strong>
              <p class="as-hint">仅本次使用的凭据会在关闭面板后清除。</p>
            </div>
            <div class="as-actions">
              <button class="as-btn" type="button" data-use-once>仅本次使用</button>
              <button class="as-btn as-primary" type="button" data-save-credential>保存凭据</button>
            </div>
          </div>
          <section class="as-terminal" aria-label="SSH 终端">
            <header class="as-console-head">
              <div class="as-console-title-group">
                <span class="as-term-dot-badge">●</span>
                <strong data-console-title>SSH 终端</strong>
                <span class="as-term-cwd-badge" data-cwd-badge hidden>~</span>
              </div>
              <div class="as-console-meta">
                <span data-status role="status"></span>
                <button class="as-btn as-quiet as-term-clear-btn" type="button" data-clear-term title="清空终端屏幕">清屏</button>
              </div>
            </header>
            <div class="as-output" data-out role="log" aria-label="终端输出" tabindex="0"></div>
            <form class="as-command" data-command>
              <div class="as-prompt" data-prompt aria-hidden="true"><span class="as-p-user">user@host</span><span class="as-p-sep">:</span><span class="as-p-path">~</span><span class="as-p-char">$</span></div>
              <input class="no-focus-ring as-cmd-input" data-input aria-label="SSH 命令" placeholder="" autocomplete="off" spellcheck="false" disabled>
              <button class="as-btn as-primary as-cmd-run" type="submit" data-run disabled>执行</button>
            </form>
          </section>
          <footer class="as-terminal-footer">
            <div class="as-actions">
              <details class="as-history" data-history hidden>
                <summary class="as-btn as-quiet">${icon("history")}命令历史</summary>
                <div class="as-history-list" data-hist></div>
              </details>
              <button class="as-btn as-quiet" type="button" data-creds>${icon("settings")}设置</button>
            </div>
          </footer>
        </section>
      </div>
    </dialog>
    <dialog class="as-dialog" data-dlg aria-labelledby="agy-ssh-dialog-title">
      <form class="as-form" data-dlg-form>
        <h2 id="agy-ssh-dialog-title" data-dlg-title></h2>
        <div data-dlg-body></div>
        <p class="as-dlg-error" data-dlg-error role="alert" hidden></p>
        <footer class="as-dlg-actions">
          <button class="as-btn as-quiet as-danger" type="button" data-delete-server hidden>删除服务器</button>
          <button class="as-btn" type="button" data-dlg-cancel>取消</button>
          <button class="as-btn as-primary" type="submit" data-dlg-ok>保存</button>
        </footer>
      </form>
    </dialog>`;
  document.body.appendChild(root);

  const $ = (selector) => root.querySelector(selector);
  const panel = $("[data-panel]");
  const srvList = $("[data-srvlist]");
  const search = $("[data-search]");
  const out = $("[data-out]");
  const input = $("[data-input]");
  const addBtn = $("[data-add-srv]");
  const runBtn = $("[data-run]");
  const editBtn = $("[data-edit]");
  const refreshBtn = $("[data-refresh]");
  const saveCredentialBtn = $("[data-save-credential]");
  const useOnceBtn = $("[data-use-once]");
  const history = $("[data-history]");
  const dlg = $("[data-dlg]");
  const dlgBody = $("[data-dlg-body]");
  const dlgError = $("[data-dlg-error]");
  const dlgOk = $("[data-dlg-ok]");
  const dlgCancel = $("[data-dlg-cancel]");
  const deleteServerBtn = $("[data-delete-server]");

  let servers = [], credentials = [], current = null;
  let serviceAvailable = false, activity = "", saveDialog = null;
  let logPollTimer = null, lastSyncServer = null, lastSyncTimestamp = 0;
  const renderedLogIds = new Set();
  let currentServerUser = "user", currentServerHost = "host", currentServerCwd = "~";
  const terminals = new Map();
  const connectionResults = new Map();
  const sessionCredentials = new Map();
  const stateLabels = { testing: "测试连接中…", ok: "连接正常", failed: "连接失败" };

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  async function api(path, opts = {}) {
    const response = await fetch(API + path, {
      method: opts.method || "GET",
      headers: { "Content-Type": "application/json" },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    return response.json();
  }

  async function request(path, opts) {
    const result = await api(path, opts);
    if (!result.ok) throw new Error(result.error || "本地服务返回错误");
    return result;
  }

  function serverAddress(server) {
    const hostname = server.hostname || server.name;
    const host = hostname.includes(":") && !hostname.startsWith("[") ? "[" + hostname + "]" : hostname;
    const username = sessionCredentials.get(server.name)?.username ||
      credentials.find(({ id }) => id === server.credentialId)?.username || server.user;
    return (username ? username + "@" : "") + host + ":" + (server.port || 22);
  }

  function isGitHubServer(server) {
    return /^(?:ssh\.)?github(?:\.com)?\.?$/i.test((server.hostname || server.name).trim());
  }

  function setService(message, error = false) {
    const status = $("[data-api]");
    status.textContent = message;
    status.hidden = !message;
    status.toggleAttribute("data-error", error);
  }

  async function loadServers(selectedName) {
    try {
      const result = await request("/api/servers");
      servers = (result.servers || []).filter((server) => !isGitHubServer(server));
      for (const [name, credential] of sessionCredentials) {
        const server = servers.find((item) => item.name === name);
        if (!server || (server.hostname || server.name) !== credential.hostname ||
            (server.port || 22) !== credential.port || server.credentialId) {
          sessionCredentials.delete(name);
          connectionResults.delete(name);
        }
      }
      const preferred = selectedName ?? current?.name;
      current = servers.find((server) => server.name === preferred) || servers[0] || null;
      if (selectedName) search.value = "";
      serviceAvailable = true;
      setService("");
    } catch {
      serviceAvailable = false;
      setService("本地服务不可用", true);
    }
    renderServers();
    renderCurrent();
  }

  function renderServers() {
    $("[data-count]").textContent = servers.length ? String(servers.length) : "";
    $("[data-filter]").hidden = !servers.length;
    if (!servers.length) {
      const message = serviceAvailable
        ? "<strong>还没有服务器</strong>点击「添加」配置 SSH 主机。"
        : "<strong>无法加载服务器</strong>确认本地服务已启动后，点击「刷新」。";
      srvList.innerHTML = '<p class="as-empty">' + message + "</p>";
      return;
    }

    const groups = new Map();
    const query = search.value.trim().toLowerCase();
    for (const server of servers) {
      const group = server.group || "默认";
      if (query && ![server.name, serverAddress(server), group].some((text) => text.toLowerCase().includes(query))) continue;
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(server);
    }
    if (!groups.size) {
      srvList.innerHTML = '<p class="as-empty">没有匹配的服务器</p>';
      return;
    }

    srvList.innerHTML = [...groups].map(([group, list]) => {
      const heading = groups.size === 1 && group === "默认"
        ? "" : `<p class="as-group">${esc(group)}</p>`;
      return heading + list.map((server) => {
        const address = esc(serverAddress(server));
        return `<button class="as-server" type="button" data-name="${esc(server.name)}" aria-pressed="false">
          <span>
            <span class="as-server-name" title="${esc(server.name)}">${esc(server.name)}</span>
            <span class="as-server-address" title="${address}">${address}</span>
          </span>
          <span class="as-server-state" role="img" hidden></span>
        </button>`;
      }).join("");
    }).join("");
  }

  function renderServerStates() {
    srvList.querySelectorAll("[data-name]").forEach((row) => {
      const state = connectionResults.get(row.dataset.name)?.state;
      row.setAttribute("aria-pressed", String(current?.name === row.dataset.name));
      const dot = row.querySelector(".as-server-state");
      dot.hidden = !state;
      dot.dataset.state = state || "";
      dot.title = stateLabels[state] || "";
      dot.setAttribute("aria-label", dot.title);
    });
  }

  function renderControls() {
    const canConnect = serviceAvailable && !!current && !activity;
    const canManage = serviceAvailable && !activity && !refreshBtn.disabled;
    input.disabled = !canConnect;
    runBtn.disabled = !canConnect || !input.value.trim();
    editBtn.disabled = !canManage;
    addBtn.disabled = !canManage;
    addBtn.classList.toggle("as-primary", canManage && !servers.length);
    $("[data-creds]").disabled = !canManage;

    const result = connectionResults.get(current?.name);
    $("[data-host-key]").hidden = !result?.hostKeyChanged;
    $("[data-update-key]").disabled = !canConnect;
    const offer = sessionCredentials.get(current?.name)?.offerSave && result?.state === "ok";
    $("[data-credential-offer]").hidden = !offer;
    saveCredentialBtn.disabled = useOnceBtn.disabled = !canManage;
    const status = $("[data-status]");
    status.dataset.state = activity ? "" : result?.state || "";
    status.textContent = activity || stateLabels[result?.state] || "";
  }

  function ansiToHtml(text) {
    if (!text) return "";
    let s = esc(text);
    const colorMap = {
      "30": "#484f58", "31": "#f85149", "32": "#3fb950", "33": "#d29922",
      "34": "#58a6ff", "35": "#bc8cff", "36": "#39c5cf", "37": "#b1bac4",
      "90": "#6e7681", "91": "#ff7b72", "92": "#56d364", "93": "#e3b341",
      "94": "#79c0ff", "95": "#d2a8ff", "96": "#56d4dd", "97": "#f0f6fc",
    };
    s = s.replace(/\x1b\[([0-9;]+)m/g, (_, code) => {
      if (code === "0" || code === "00") return "</span>";
      const parts = code.split(";");
      const styles = [];
      for (const p of parts) {
        if (p === "1") styles.push("font-weight:bold");
        else if (colorMap[p]) styles.push("color:" + colorMap[p]);
      }
      return styles.length ? '<span style="' + styles.join(";") + '">' : "</span>";
    });
    return s.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "");
  }

  function renderLogEntry(entry) {
    const el = document.createElement("div");
    el.className = "as-log-entry";
    el.dataset.id = entry.id;
    if (entry.source) el.dataset.source = entry.source;

    const user = esc(entry.user || currentServerUser || "user");
    const host = esc(entry.host || currentServerHost || "host");
    const cwd = esc(entry.cwd || "~");
    const char = user === "root" ? "#" : "$";
    const isMcp = entry.source === "mcp";
    const hasExit = entry.code !== null && entry.code !== undefined && entry.code !== 0;

    let metaHtml = "";
    if (isMcp) {
      metaHtml += '<span class="as-badge-mcp" title="Antigravity MCP 执行">🤖 MCP</span>';
    }
    if (entry.ms) {
      metaHtml += `<span class="as-log-time">${entry.ms}ms</span>`;
    }
    if (hasExit) {
      metaHtml += `<span class="as-log-exit">[exit ${entry.code}]</span>`;
    }

    const cleanStdout = (entry.stdout || "").replace(/^[\r\n]+/, "").replace(/[\r\n]+$/, "");
    const cleanStderr = (entry.stderr || "").replace(/^[\r\n]+/, "").replace(/[\r\n]+$/, "");
    const stdoutHtml = cleanStdout ? ansiToHtml(cleanStdout) : "";
    const stderrHtml = cleanStderr ? ansiToHtml(cleanStderr) : "";

    el.innerHTML = `<div class="as-log-prompt-line"><span class="as-prompt"><span class="as-p-user">${user}@${host}</span><span class="as-p-sep">:</span><span class="as-p-path">${cwd}</span><span class="as-p-char">${char}</span></span><span class="as-log-cmd">${esc(entry.command)}</span><span class="as-log-meta">${metaHtml}</span></div>` +
      (stdoutHtml ? `<div class="as-log-stdout">${stdoutHtml}</div>` : "") +
      (stderrHtml ? `<div class="as-log-stderr">${stderrHtml}</div>` : "");
    return el;
  }

  function renderWelcomeBanner(user, host) {
    const welcome = document.createElement("div");
    welcome.className = "as-term-welcome";
    welcome.innerHTML = `
      <div class="as-term-welcome-title">已连接到 <strong class="as-p-user">${esc(user)}@${esc(host)}</strong> (持久化会话就绪)</div>
      <div class="as-term-welcome-desc">全域同步已启用：Antigravity（MCP 工具）及面板执行的所有命令与输出均实时保留在此。</div>
    `;
    return welcome;
  }

  function updateInputPrompt(user, host, cwd) {
    if (user) currentServerUser = user;
    if (host) currentServerHost = host;
    if (cwd) currentServerCwd = cwd;
    const char = currentServerUser === "root" ? "#" : "$";

    const promptEl = $("[data-prompt]");
    if (promptEl) {
      promptEl.innerHTML = `<span class="as-p-user">${esc(currentServerUser)}@${esc(currentServerHost)}</span><span class="as-p-sep">:</span><span class="as-p-path">${esc(currentServerCwd)}</span><span class="as-p-char">${char}</span>`;
    }
    const badge = $("[data-cwd-badge]");
    if (badge) {
      badge.textContent = currentServerCwd;
      badge.hidden = !current;
    }
    const consoleTitle = $("[data-console-title]");
    if (consoleTitle) {
      consoleTitle.textContent = current ? `${current.name} 终端` : "SSH 终端";
    }
  }

  async function syncTerminalLogs(forceFull = false) {
    if (!current || !panel.open) return;
    const name = current.name;
    const serverChanged = lastSyncServer !== name;
    if (serverChanged || forceFull) {
      lastSyncServer = name;
      lastSyncTimestamp = 0;
      renderedLogIds.clear();
      out.replaceChildren();
    }

    try {
      const url = lastSyncTimestamp > 0
        ? `/api/terminal/logs?server=${encodeURIComponent(name)}&since=${lastSyncTimestamp}`
        : `/api/terminal/logs?server=${encodeURIComponent(name)}`;
      const res = await api(url);
      if (!res.ok) return;

      updateInputPrompt(res.user, res.host, res.cwd);

      const logs = res.logs || [];
      const isScrolledToBottom = out.scrollHeight - out.scrollTop <= out.clientHeight + 60;

      if (logs.length === 0 && out.childElementCount === 0) {
        out.appendChild(renderWelcomeBanner(res.user, res.host));
      } else {
        const welcome = out.querySelector(".as-term-welcome");
        if (welcome && logs.length > 0) welcome.remove();

        let added = false;
        for (const logItem of logs) {
          if (logItem.timestamp > lastSyncTimestamp) {
            lastSyncTimestamp = logItem.timestamp;
          }
          if (!renderedLogIds.has(logItem.id)) {
            renderedLogIds.add(logItem.id);
            out.appendChild(renderLogEntry(logItem));
            added = true;
          }
        }
        if (added && isScrolledToBottom) {
          out.scrollTop = out.scrollHeight;
        }
      }
    } catch (e) {}
  }

  function renderCurrent() {
    const host = $("[data-host]");
    const address = $("[data-address]");
    host.textContent = current?.name || "终端";
    host.title = current?.name || "";
    address.textContent = current ? serverAddress(current) : "";
    address.title = address.textContent;
    address.hidden = !current;
    $("[data-server-actions]").hidden = !current;
    const credUsername = sessionCredentials.get(current?.name)?.username ||
      credentials.find(({ id }) => id === current?.credentialId)?.username || current?.user || "user";
    updateInputPrompt(credUsername, current?.hostname || current?.name || "host", currentServerCwd || "~");
    renderServerStates();
    renderControls();
    syncTerminalLogs();
  }

  function log(name, text, cls) {
    if (current?.name !== name) return;
    const el = document.createElement("div");
    el.className = "as-log-entry " + (cls || "");
    el.style.fontSize = "12px";
    el.style.opacity = "0.85";
    el.textContent = text;
    out.appendChild(el);
    out.scrollTop = out.scrollHeight;
  }

  async function loadCredentials() {
    try {
      const result = await request("/api/credentials");
      credentials = result.credentials || [];
    } catch {}
  }

  async function refreshCredentials(changedId) {
    await loadCredentials();
    for (const server of servers) {
      if (server.credentialId === changedId) connectionResults.delete(server.name);
    }
    renderServers();
    renderCurrent();
  }

  function openDialog(title, formContent, onSubmit, options = {}) {
    const { confirmLabel = "保存", destructive = false, onRemove = null } = options;
    saveDialog = onSubmit;
    $("[data-dlg-title]").textContent = title;
    dlgBody.innerHTML = formContent;
    dlgBody.querySelectorAll("input").forEach((i) => i.classList.add("no-focus-ring"));
    dlgError.hidden = true;
    dlgOk.textContent = confirmLabel;
    dlgOk.className = "as-btn " + (destructive ? "as-danger" : "as-primary");
    dlgOk.hidden = !onSubmit;
    dlgCancel.textContent = onSubmit ? "取消" : "关闭";
    deleteServerBtn.hidden = !onRemove;
    deleteServerBtn.onclick = onRemove;
    if (!dlg.open) dlg.showModal();
    (dlgBody.querySelector("input") || dlgCancel).focus();
  }

  function showConfirm(title, message, onSubmit) {
    openDialog(title, `<p>${esc(message)}</p>`, onSubmit, { confirmLabel: "删除", destructive: true });
  }

  function setupUserPicker(user, usernames) {
    const toggle = dlgBody.querySelector("[data-user-toggle]");
    const list = dlgBody.querySelector("[data-user-options]");
    let visible = [];
    let active = -1;

    function render(all) {
      const query = all ? "" : user.value.trim().toLowerCase();
      visible = usernames.filter((name) => name.toLowerCase().includes(query));
      active = -1;
      user.removeAttribute("aria-activedescendant");
      if (!visible.length) {
        list.hidePopover();
        return;
      }
      list.innerHTML = visible.map((name, index) => {
        const selected = name === user.value.trim();
        return `<div class="as-user-option" role="option" id="agy-ssh-option-${index}" data-index="${index}"
          aria-selected="${selected}">${icon("key")}<span>${esc(name)}</span>${selected ? icon("check") : ""}</div>`;
      }).join("");
      list.showPopover();
    }
    function pick(index) {
      if (visible[index] === undefined) return;
      user.value = visible[index];
      user.dispatchEvent(new Event("input", { bubbles: true }));
      list.hidePopover();
      user.focus();
    }
    list.addEventListener("toggle", () => {
      const open = list.matches(":popover-open");
      user.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-expanded", String(open));
      if (!open) user.removeAttribute("aria-activedescendant");
    });
    toggle.hidden = !usernames.length;
    toggle.addEventListener("pointerdown", (event) => event.preventDefault());
    toggle.addEventListener("click", () => {
      user.focus();
      if (list.matches(":popover-open")) list.hidePopover();
      else render(true);
    });
    user.addEventListener("click", () => render(true));
    user.addEventListener("input", () => render(false));
    user.addEventListener("blur", () => list.hidePopover());
    list.addEventListener("mousedown", (event) => event.preventDefault());
    list.addEventListener("click", (event) => {
      const row = event.target.closest("[data-index]");
      if (row) pick(Number(row.dataset.index));
    });
    user.addEventListener("keydown", (event) => {
      if (event.isComposing) return;
      const open = list.matches(":popover-open");
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (!open) render(true);
        if (!visible.length) return;
        event.preventDefault();
        const last = visible.length - 1;
        active = event.key === "ArrowDown" ? Math.min(last, active + 1) : active < 0 ? last : Math.max(0, active - 1);
        const row = list.children[active];
        list.querySelector("[data-active]")?.removeAttribute("data-active");
        row.setAttribute("data-active", "");
        user.setAttribute("aria-activedescendant", row.id);
        row.scrollIntoView({ block: "nearest" });
      } else if (open && (event.key === "Escape" || event.key === "Enter")) {
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "Enter" && active >= 0) pick(active);
        else list.hidePopover();
      }
    });
  }

  function showServerDialog(server) {
    const sessionUsername = sessionCredentials.get(server?.name)?.username;
    const linkedCredential = credentials.find(({ id }) => id === server?.credentialId);
    const savedUsers = [...new Set(credentials.filter(({ hasPassword, username }) =>
      hasPassword && username).map(({ username }) => username))];
    let savedCredential = linkedCredential;
    const fields = `
      <div class="as-field-row">
        <label class="as-field">服务器名称
          <input class="no-focus-ring" name="name" required value="${esc(server?.name)}" placeholder="例如 build-runner"></label>
        <label class="as-field">分组
          <input class="no-focus-ring" name="group" value="${esc(server?.group || "默认")}"></label>
      </div>
      <div class="as-field-row">
        <label class="as-field">主机地址
          <input class="no-focus-ring" name="hostname" value="${esc(server?.hostname)}" placeholder="留空时使用服务器名称"></label>
        <label class="as-field">端口
          <input class="no-focus-ring" name="port" type="number" min="1" max="65535" value="${esc(server?.port || 22)}"></label>
      </div>
      <div class="as-field" data-server-user>
        <label for="agy-ssh-user">SSH 用户名</label>
        <div class="as-user-control">${icon("user")}
          <input id="agy-ssh-user" class="no-focus-ring" name="user" role="combobox" aria-autocomplete="list" aria-controls="agy-ssh-users"
            aria-expanded="false" value="${esc(sessionUsername || linkedCredential?.username || server?.user)}"
            placeholder="${savedUsers.length ? "输入或选择已保存的用户名" : "例如 pi"}" autocomplete="off" spellcheck="false">
          <button type="button" class="as-btn as-quiet as-icon-button" data-user-toggle aria-label="选择已保存的用户名"
            aria-controls="agy-ssh-users" aria-expanded="false" tabindex="-1">${icon("down")}</button>
        </div>
        <div id="agy-ssh-users" class="as-user-options" role="listbox" aria-label="已保存的用户名" popover="manual" data-user-options></div>
      </div>
      <label class="as-field" data-matching-passwords hidden>选择已保存的密码
        <select class="as-select" data-password-choice></select>
      </label>
      <div class="as-field" data-server-password>
        <label for="agy-ssh-server-password">SSH 密码（可选）</label>
        <div class="as-password-entry">
          <input id="agy-ssh-server-password" class="no-focus-ring" name="password" type="password" autocomplete="new-password">
          <button class="as-btn as-quiet" type="button" data-clear-credential hidden>清除已填凭据</button>
        </div>
        <span class="as-hint" data-password-hint role="status"></span>
      </div>`;

    const onRemove = server ? () => {
      showConfirm("删除服务器", "确定删除「" + server.name + "」？", async () => {
        await request("/api/servers", { method: "DELETE", body: { name: server.name } });
        terminals.delete(server.name);
        connectionResults.delete(server.name);
        sessionCredentials.delete(server.name);
        await loadServers();
      });
    } : null;

    openDialog(server ? "编辑服务器" : "添加服务器", fields, async (form) => {
      const name = form.get("name").trim();
      if (!name) throw new Error("请填写服务器名称");
      if (servers.some((item) => item.name === name && item.name !== server?.name)) {
        throw new Error("服务器名称已存在");
      }
      const username = form.get("user").trim();
      const password = form.get("password");
      if (password && !username) throw new Error("密码登录需要 SSH 用户名");
      const credentialId = password ? "" : savedCredential?.id || "";
      if (!password && !credentialId && !matchingPasswords.hidden) {
        throw new Error("请选择该用户保存的密码，或输入密码");
      }
      const body = {
        oldName: server?.name,
        name,
        hostname: form.get("hostname").trim() || name,
        port: Number(form.get("port")) || 22,
        group: form.get("group").trim() || "默认",
        user: password ? server?.user || "" : username,
        identityFile: server?.identityFile || "",
        credentialId,
      };
      if (isGitHubServer(body)) throw new Error("GitHub 的 SSH 地址已从服务器列表过滤");
      await request("/api/servers", { method: server ? "PUT" : "POST", body });
      if (server && terminals.has(server.name) && server.name !== name) {
        terminals.set(name, terminals.get(server.name));
        terminals.delete(server.name);
      }
      if (server) {
        connectionResults.delete(server.name);
        sessionCredentials.delete(server.name);
      }
      if (password) {
        sessionCredentials.set(name, {
          username, password, hostname: body.hostname, port: body.port, offerSave: true,
        });
      }
      await loadServers(name);
      if (!server || password || credentialId !== (server.credentialId || "")) void testConnection(name);
    }, { onRemove, confirmLabel: server ? "保存" : "添加并连接" });
    const user = dlgBody.querySelector('[name="user"]');
    const password = dlgBody.querySelector('[name="password"]');
    const choice = dlgBody.querySelector("[data-password-choice]");
    const matchingPasswords = dlgBody.querySelector("[data-matching-passwords]");
    const hint = dlgBody.querySelector("[data-password-hint]");
    const clearCredential = dlgBody.querySelector("[data-clear-credential]");
    const updatePassword = () => {
      password.placeholder = savedCredential?.hasPassword ? "••••••••" : "";
      clearCredential.hidden = !savedCredential;
      user.required = !!password.value;
      hint.textContent = savedCredential?.hasPassword ? "已填入该用户保存的密码。" :
        savedCredential ? "沿用这台服务器保存的 SSH 密钥。" :
          "留空使用系统 SSH。新密码在连接成功后可选择保存。";
    };
    user.addEventListener("input", () => {
      const matches = credentials.filter(({ username, hasPassword }) => hasPassword && username === user.value.trim());
      savedCredential = matches.length === 1 ? matches[0] : null;
      matchingPasswords.hidden = matches.length < 2;
      choice.replaceChildren(new Option("请选择", ""), ...matches.map(({ id }, index) =>
        new Option("已保存的密码 " + (index + 1), id)));
      if (matches.length) password.value = "";
      updatePassword();
    });
    choice.addEventListener("change", () => {
      savedCredential = credentials.find(({ id }) => id === choice.value);
      if (savedCredential) password.value = "";
      updatePassword();
    });
    password.addEventListener("input", () => {
      savedCredential = null;
      choice.value = "";
      updatePassword();
    });
    clearCredential.addEventListener("click", () => {
      savedCredential = null;
      choice.value = "";
      matchingPasswords.hidden = true;
      updatePassword();
      password.focus();
    });
    updatePassword();
    setupUserPicker(user, savedUsers);
  }

  function showCredentialDialog(credential) {
    const legacyKey = credential && !credential.hasPassword;
    const fields = `
      <label class="as-field">SSH 用户名
        <input class="no-focus-ring" name="username" value="${esc(credential?.username)}" placeholder="例如 pi" ${legacyKey ? "" : "required"}>
      </label>
      ${legacyKey ? `<label class="as-field">本机私钥文件路径
        <input class="no-focus-ring" name="identityFile" value="${esc(credential.identityFile)}" placeholder="~/.ssh/id_ed25519">
      </label>` : `<label class="as-field">SSH 密码
        <input class="no-focus-ring" name="password" type="password" autocomplete="new-password" ${credential?.hasPassword ? "" : "required"}>
        ${credential?.hasPassword ? '<span class="as-hint">留空时保留当前密码。</span>' : ""}
      </label>`}`;

    openDialog(credential ? "编辑凭据" : "添加凭据", fields, async (form) => {
      const username = form.get("username").trim();
      if (!username && !legacyKey) throw new Error("请填写 SSH 用户名");
      const password = form.get("password");
      const body = {
        id: credential?.id,
        name: username || credential?.name,
        username,
        identityFile: form.get("identityFile")?.trim() ?? credential?.identityFile ?? "",
      };
      if (password) body.password = password;
      await request("/api/credentials", { method: "POST", body });
      await refreshCredentials(body.id);
    });
  }

  function showCredentials() {
    const list = credentials.length ? credentials.map((credential) => `
      <div class="as-cred-row">
        <div class="as-cred-identity">
          <strong>${esc(credential.username || credential.name)}</strong>
          <span class="as-hint">${credential.hasPassword ? "已保存密码" : "SSH 密钥"}</span>
        </div>
        <button class="as-btn" type="button" data-edit-cred="${esc(credential.id)}">编辑</button>
        <button class="as-btn as-danger as-quiet" type="button" data-delete-cred="${esc(credential.id)}">删除</button>
      </div>`).join("") : '<p class="as-hint">还没有保存的凭据。</p>';
    openDialog("用户凭据", list + `
      <button class="as-btn as-primary as-add-cred" type="button" data-add-cred>${icon("plus")}添加凭据</button>`, null);
  }

  dlgBody.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.hasAttribute("data-add-cred")) return showCredentialDialog(null);
    const credential = credentials.find(({ id }) => id === (button.dataset.editCred || button.dataset.deleteCred));
    if (!credential) return;
    if (button.hasAttribute("data-edit-cred")) return showCredentialDialog(credential);
    showConfirm("删除凭据", "确定删除「" + (credential.username || credential.name) + "」的凭据？", async () => {
      await request("/api/credentials", { method: "DELETE", body: { id: credential.id } });
      await refreshCredentials(credential.id);
    });
  });

  dlgCancel.addEventListener("click", () => dlg.close());
  dlg.addEventListener("cancel", (event) => {
    if (dlgOk.disabled) event.preventDefault();
  });
  dlg.addEventListener("close", () => {
    dlgBody.replaceChildren();
    saveDialog = null;
  });
  $("[data-dlg-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!saveDialog || dlgOk.disabled) return;
    const fields = new FormData(event.currentTarget);
    dlgError.hidden = true;
    dlgBody.inert = true;
    dlgOk.disabled = dlgCancel.disabled = deleteServerBtn.disabled = true;
    try {
      await saveDialog(fields);
      dlg.close();
    } catch (error) {
      dlgError.textContent = error.message;
      dlgError.hidden = false;
    } finally {
      dlgBody.inert = false;
      dlgOk.disabled = dlgCancel.disabled = deleteServerBtn.disabled = false;
    }
  });

  async function loadHistory() {
    try {
      const result = await request("/api/history");
      const commands = [...new Set((result.history || []).map((entry) => entry.command))].filter(Boolean).slice(0, 20);
      history.hidden = !commands.length;
      if (!commands.length) history.open = false;
      $("[data-hist]").innerHTML = commands.map((cmd) => `<button type="button" data-cmd="${esc(cmd)}">${esc(cmd)}</button>`).join("");
    } catch {}
  }

  function connectionBody(name) {
    const draft = sessionCredentials.get(name);
    if (!draft) return { server: name };
    const { username, password, hostname, port } = draft;
    return { server: name, credentialId: "", username, password, hostname, port };
  }

  async function saveConnectedCredential() {
    const name = current?.name;
    const draft = sessionCredentials.get(name);
    if (!draft?.offerSave || connectionResults.get(name)?.state !== "ok" || saveCredentialBtn.disabled) return;
    draft.id ||= "ssh-" + Array.from(crypto.getRandomValues(new Uint8Array(16)),
      (byte) => byte.toString(16).padStart(2, "0")).join("");
    const { username, password, hostname, port, id } = draft;
    activity = "保存凭据中…";
    renderControls();
    try {
      await request("/api/servers/credential", {
        method: "POST", body: { server: name, username, password, hostname, port, id },
      });
      sessionCredentials.delete(name);
      await loadCredentials();
      await loadServers();
      log(name, "已保存登录凭据。", "as-line-ok");
    } catch (error) {
      log(name, "保存凭据失败：" + error.message, "as-line-err");
    } finally {
      activity = "";
      renderControls();
    }
  }

  async function runCommand(command) {
    if (!current || input.disabled || !command.trim()) return;
    const cmd = command.trim();
    if (cmd.toLowerCase() === "clear" || cmd.toLowerCase() === "cls" || cmd.toLowerCase() === "reset") {
      input.value = "";
      out.replaceChildren();
      return;
    }
    const { name } = current;
    const body = { ...connectionBody(name), command: cmd, source: "ui" };
    const restoreFocus = [input, runBtn].includes(document.activeElement);
    input.value = "";
    activity = "执行中…";
    renderControls();
    try {
      const result = await api("/api/exec", { method: "POST", body });
      await syncTerminalLogs();
      if (result.error) log(name, "错误：" + result.error, "as-line-err");
      await loadHistory();
    } catch (error) {
      log(name, "请求失败：" + error.message, "as-line-err");
    } finally {
      activity = "";
      renderControls();
      if (restoreFocus && panel.open && current?.name === name &&
          [document.body, panel].includes(document.activeElement)) input.focus();
    }
  }

  async function testConnection(name) {
    const previous = connectionResults.get(name);
    if (!serviceAvailable || previous?.state === "testing") return;
    const pending = { state: "testing" };
    connectionResults.set(name, pending);
    renderServerStates();
    renderControls();
    const result = await api("/api/test", { method: "POST", body: connectionBody(name) })
      .catch((error) => ({ ok: false, error: error.message }));
    if (connectionResults.get(name) !== pending) return;
    const detail = result.err || result.error || "";
    const hostKeyChanged = !result.ok && /HOST IDENTIFICATION HAS CHANGED|Host key verification failed/i.test(detail);
    connectionResults.set(name, { state: result.ok ? "ok" : "failed", hostKeyChanged, detail });
    if (!result.ok && (previous?.state !== "failed" || previous.detail !== detail)) {
      log(name, detail ? "连接失败：" + detail : "连接失败", "as-line-err");
    }
    renderServerStates();
    renderControls();
  }

  async function updateHostKey() {
    if (!current || activity || !connectionResults.get(current.name)?.hostKeyChanged) return;
    const { name, hostname } = current;
    activity = "更新主机指纹中…";
    renderControls();
    try {
      const result = await request("/api/known-hosts/remove", {
        method: "POST", body: { host: hostname || name },
      });
      connectionResults.delete(name);
      log(name, "已移除旧指纹并备份 known_hosts。再次点选服务器可测试连接。", "as-line-ok");
      if (result.backup) log(name, "备份：" + result.backup, "as-line-dim");
    } catch (error) {
      log(name, "更新失败：" + error.message, "as-line-err");
    } finally {
      activity = "";
      renderServerStates();
      renderControls();
    }
  }

  async function refresh() {
    if (refreshBtn.disabled) return;
    refreshBtn.disabled = true;
    renderControls();
    setService("正在刷新…");
    try {
      await Promise.all([loadCredentials().then(() => loadServers()), loadHistory()]);
    } finally {
      refreshBtn.disabled = false;
      renderControls();
    }
  }

  search.addEventListener("input", () => {
    renderServers();
    renderServerStates();
  });
  srvList.addEventListener("click", (event) => {
    const row = event.target.closest("[data-name]");
    if (!row) return;
    const name = row.dataset.name;
    if (name !== current?.name) {
      current = servers.find((server) => server.name === name);
      input.value = "";
      renderCurrent();
      syncTerminalLogs(true);
    }
    testConnection(name);
  });
  input.addEventListener("input", renderControls);
  $("[data-command]").addEventListener("submit", (event) => {
    event.preventDefault();
    runCommand(input.value);
  });
  const clearTermBtn = $("[data-clear-term]");
  if (clearTermBtn) {
    clearTermBtn.addEventListener("click", async () => {
      out.replaceChildren();
      renderedLogIds.clear();
      lastSyncTimestamp = Date.now();
      if (current?.name) {
        try {
          await api(`/api/terminal/logs?server=${encodeURIComponent(current.name)}`, { method: "DELETE" });
        } catch (e) {}
      }
    });
  }
  $("[data-hist]").addEventListener("click", (event) => {
    const picked = event.target.closest("[data-cmd]");
    if (!picked || input.disabled) return;
    input.value = picked.dataset.cmd;
    history.open = false;
    renderControls();
    input.focus();
  });
  addBtn.addEventListener("click", () => showServerDialog(null));
  $("[data-creds]").addEventListener("click", showCredentials);
  editBtn.addEventListener("click", () => showServerDialog(current));
  saveCredentialBtn.addEventListener("click", saveConnectedCredential);
  useOnceBtn.addEventListener("click", () => {
    const draft = sessionCredentials.get(current?.name);
    if (!draft) return;
    draft.offerSave = false;
    renderControls();
    input.focus();
  });
  $("[data-update-key]").addEventListener("click", updateHostKey);
  refreshBtn.addEventListener("click", refresh);
  $("[data-close]").addEventListener("click", () => panel.close());
  panel.addEventListener("click", (event) => {
    if (!history.contains(event.target)) history.open = false;
    if (event.target !== panel) return;
    const rect = panel.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX >= rect.right ||
        event.clientY < rect.top || event.clientY >= rect.bottom) panel.close();
  });
  panel.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !history.open) return;
    event.preventDefault();
    history.open = false;
    history.querySelector("summary").focus();
  });
  panel.addEventListener("close", () => {
    if (logPollTimer) {
      clearInterval(logPollTimer);
      logPollTimer = null;
    }
    search.value = "";
    history.open = false;
    for (const name of sessionCredentials.keys()) connectionResults.delete(name);
    sessionCredentials.clear();
    renderServers();
    renderCurrent();
  });

  function open() {
    if (panel.open) return;
    renderCurrent();
    panel.showModal();
    refresh();
    syncTerminalLogs(true);
    if (!logPollTimer) {
      logPollTimer = setInterval(() => syncTerminalLogs(), 1200);
    }
  }
  window.__agy_ssh_open = open;

  /* ---------------- 侧边栏菜单 ---------------- */
  const ICON = '<svg class="agy-ic" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="2" y="4" width="20" height="6" rx="2"/><rect x="2" y="14" width="20" height="6" rx="2"/>' +
    '<circle cx="6" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="6" cy="17" r="1" fill="currentColor" stroke="none"/>' +
    '<path d="M10 7h8M10 17h8"/></svg>';
  function mountMenuItem() {
    if (document.getElementById(ITEM_ID)) return true;
    const nav = document.querySelector('[data-testid="sidebar-navigation-items"]');
    if (!nav) return false;
    let anchor = nav.querySelector('a[href="/customizations"]');
    if (!anchor) anchor = [...nav.querySelectorAll("a,button")].find((el) => /customizations/i.test(el.textContent || ""));
    const item = document.createElement("button");
    item.id = ITEM_ID; item.type = "button";
    item.className = anchor ? anchor.className :
      "agy-button inline-flex items-center font-medium transition-colors select-none outline-none cursor-pointer flex-grow w-full justify-start font-normal min-w-0 gap-1.5 px-2 rounded-lg py-1.5 bg-transparent text-secondary-foreground hover:bg-sidebar-muted";
    item.title = "SSH 管理";
    item.setAttribute("aria-haspopup", "dialog");
    item.innerHTML = ICON + "<span>SSH 管理</span>";
    item.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); open(); });
    if (anchor && anchor.parentElement === nav) anchor.insertAdjacentElement("afterend", item);
    else nav.appendChild(item);
    return true;
  }
  let tries = 0;
  const timer = setInterval(() => { tries++; if (mountMenuItem() || tries > 40) clearInterval(timer); }, 400);
  mountMenuItem();

  let moScheduled = false;
  const mo = new MutationObserver((mutations) => {
    if (document.getElementById(ITEM_ID)) return;
    let relevant = false;
    for (let i = 0; i < mutations.length; i++) {
      const m = mutations[i];
      if (m.type === "childList") {
        const t = m.target;
        if (t && t.nodeType === 1 && t.closest && t.closest('aside, [data-testid="sidebar-navigation-items"]')) {
          relevant = true;
          break;
        }
        for (let j = 0; j < m.addedNodes.length; j++) {
          const n = m.addedNodes[j];
          if (n.nodeType === 1) {
            if (n.id === ITEM_ID || n.tagName === "ASIDE" || n.getAttribute?.("data-testid") === "sidebar-navigation-items") {
              relevant = true;
              break;
            }
            if (n.querySelector && n.querySelector('[data-testid="sidebar-navigation-items"]')) {
              relevant = true;
              break;
            }
          }
        }
        if (relevant) break;
      }
    }
    if (relevant && !moScheduled) {
      moScheduled = true;
      requestAnimationFrame(() => {
        moScheduled = false;
        mountMenuItem();
      });
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });

  window.__agy_ssh_cleanup = () => {
    try { mo.disconnect(); } catch (e) {}
    try { clearInterval(timer); } catch (e) {}
    try { if (logPollTimer) clearInterval(logPollTimer); } catch (e) {}
  };
  window.__agy_ssh_ver = PANEL_VERSION;

  if (wasModalOpen) {
    setTimeout(() => { try { open(); } catch (e) {} }, 60);
  }

  return "injected";
})();
