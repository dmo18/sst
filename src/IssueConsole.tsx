import type { DiagnosticSource, IssueBrief, IssueConsoleModel } from './statusViewModel';

function timeLabel(value?: string): string {
  if (!value) return 'unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function AffectedNode({ source }: { source: DiagnosticSource }): JSX.Element {
  return <article className={`affected-node ${source.severity}`}>
    <b>{source.provider}</b>
    <span>{source.label}</span>
  </article>;
}

function IssueSummary({ issue }: { issue: IssueBrief }): JSX.Element {
  return <article className={`issue-summary ${issue.severity}`}>
    <b>{issue.provider}</b>
    <span>{issue.title}</span>
  </article>;
}

function LeadBrief({ issue }: { issue: IssueBrief }): JSX.Element {
  return <section className={`lead-brief ${issue.severity}`}>
    <header><b>{issue.provider}</b><span>{issue.status}</span></header>
    <h1>{issue.title}</h1>
    <p>{issue.detail}</p>
    <footer><span>{issue.time}</span><span>{issue.source}</span></footer>
  </section>;
}

function ClearBrief(): JSX.Element {
  return <section className="clear-brief"><b>No active issues</b><span>Readable official feeds do not report an active incident.</span></section>;
}

function DiagnosticRow({ source }: { source: DiagnosticSource }): JSX.Element {
  return <tr className={source.severity}>
    <td><span className={`state-dot ${source.severity}`} />{source.provider}<small>{source.category}</small></td>
    <td>{source.label}</td>
    <td>
      <b>{source.status}</b>
      <span>{source.message || 'No extra message returned.'}</span>
      <small>checked {timeLabel(source.checkedAt)} / parser {source.sourceType}</small>
    </td>
    <td>
      <a href={source.source} target="_blank" rel="noreferrer">{source.source}</a>
      <details>
        <summary>received status details</summary>
        {source.downloadLog.map((log, index) => <div className="download-log" key={`${source.id}-${index}`}>
          <span>started: {timeLabel(log.timestamp)}</span>
          <span>completed: {timeLabel(log.completed_at)}</span>
          {typeof log.duration_ms === 'number' ? <span>duration: {log.duration_ms} ms</span> : null}
          <span>ok: {String(log.ok ?? source.ok)}</span>
          <span>status: {log.status || source.status}</span>
          <span>parser: {log.parser || 'unknown'}</span>
          <span>message: {log.message || source.message || 'No message.'}</span>
          {log.error ? <span>error: {log.error}</span> : null}
        </div>)}
      </details>
    </td>
  </tr>;
}

export function IssueConsole({ model }: { model: IssueConsoleModel }): JSX.Element {
  const remaining = model.briefs.slice(1, 5);

  return <>
    <section className="briefing-console">
      <header className="briefing-head">
        <div><b>INCIDENT BRIEF</b><em>{model.version}</em></div>
        <span>{model.incidentCount} incidents / {model.affectedCount} affected / {timeLabel(model.generatedAt)}</span>
      </header>

      <div className="briefing-body">
        <aside className="affected-column">
          <span>Affected</span>
          {model.affected.slice(0, 5).map(source => <AffectedNode key={source.id} source={source} />)}
          {!model.affected.length ? <div className="no-affected">none</div> : null}
        </aside>

        {model.lead ? <LeadBrief issue={model.lead} /> : <ClearBrief />}

        <aside className="issue-column">
          <span>Next</span>
          {remaining.map(issue => <IssueSummary key={issue.id} issue={issue} />)}
          {!remaining.length ? <div className="no-affected">none</div> : null}
        </aside>
      </div>
    </section>

    <section className="diag-panel">
      <header><div><b>DIAGNOSTIC PROVIDER LIST</b><span>Every configured source. HTTP result, parser, timing, URL, and source detail are retained.</span></div><em>{model.diagnostics.length} providers / {model.summary.categoryCount} categories</em></header>
      <div className="diag-summary">
        <span>ok {model.summary.okCount}</span>
        <span>failed {model.summary.failedCount}</span>
        <span>major {model.summary.redCount}</span>
        <span>degraded {model.summary.amberCount}</span>
        <span>limited {model.summary.blueCount}</span>
      </div>
      <table>
        <thead><tr><th>Provider</th><th>Status</th><th>Received detail</th><th>Source detail</th></tr></thead>
        <tbody>{model.diagnostics.map(source => <DiagnosticRow key={source.id} source={source} />)}</tbody>
      </table>
    </section>
  </>;
}
