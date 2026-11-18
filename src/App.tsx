import { WorkspaceSetup } from "./components/WorkspaceSetup";
import { I18nProvider } from "./lib/i18n";

export default function App() {
  return (
    <I18nProvider>
      <WorkspaceSetup />
    </I18nProvider>
  );
}
