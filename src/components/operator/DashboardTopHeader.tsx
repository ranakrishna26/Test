export function DashboardTopHeader() {
  return (
    <header className="dashboard-top-header" aria-label="Dashboard top navigation">
      <div className="dashboard-top-header__left">
        <span className="dashboard-top-header__brand">NOKIA</span>
        <span className="dashboard-top-header__divider" aria-hidden="true" />
        <span className="dashboard-top-header__section">Autonomous Networks</span>
        <span className="dashboard-top-header__section dashboard-top-header__section--subtle">
          Subscriber Observability
        </span>
      </div>
      <div className="dashboard-top-header__right">
        <span className="dashboard-top-header__avatar" aria-hidden="true">
          AF
        </span>
        <span className="dashboard-top-header__user-name">Axel Favreau</span>
        <span className="dashboard-top-header__caret" aria-hidden="true">
          ▾
        </span>
      </div>
    </header>
  )
}
