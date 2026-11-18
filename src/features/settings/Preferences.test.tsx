// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TopNav } from "../../components/TopNav";
import { resetUserPreferences, saveUserPreferences, userPreferences, type PreferencesView } from "../../lib/api";
import { I18nProvider, useI18n } from "../../lib/i18n";
import { Preferences } from "./Preferences";

vi.mock("../../lib/api", () => ({
  userPreferences: vi.fn(),
  saveUserPreferences: vi.fn(),
  resetUserPreferences: vi.fn(),
}));

function makeView(overrides: Partial<PreferencesView> = {}, lang: "es" | "en" = "es"): PreferencesView {
  return {
    preferences: {
      version: 1,
      workspace_id: "0123456789abcdef0123456789abcdef",
      user_id: "eng1",
      theme: "light",
      ui_scale: "standard",
      language: lang,
    },
    revision: null,
    warning: null,
    ...overrides,
  };
}

function LangReader() {
  const { lang } = useI18n();
  return <span data-testid="active-lang">{lang}</span>;
}

describe("Preferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(userPreferences).mockReset();
    vi.mocked(saveUserPreferences).mockReset();
    vi.mocked(resetUserPreferences).mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("preserves pre-login localStorage language when revision === null", async () => {
    window.localStorage.setItem("easyfab.lang", "en");
    vi.mocked(userPreferences).mockResolvedValue(makeView({ revision: null, warning: null }, "es"));

    render(
      <I18nProvider>
        <LangReader />
        <Preferences visible />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect((screen.getByRole("button", { name: "Save preferences" }) as HTMLButtonElement).disabled).toBe(false);
    });
    expect(screen.getByTestId("active-lang").textContent).toBe("en");
    expect((screen.getByLabelText("Language") as HTMLSelectElement).value).toBe("en");
  });

  it("honors explicitly saved language when revision !== null and !warning", async () => {
    window.localStorage.setItem("easyfab.lang", "es");
    vi.mocked(userPreferences).mockResolvedValue(makeView({ revision: "rev-1", warning: null }, "en"));

    render(
      <I18nProvider>
        <LangReader />
        <Preferences visible />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("active-lang").textContent).toBe("en");
    });
    expect((screen.getByLabelText("Language") as HTMLSelectElement).value).toBe("en");
  });

  it("preserves pre-login language and translates warning via tError when warning !== null", async () => {
    window.localStorage.setItem("easyfab.lang", "en");
    vi.mocked(userPreferences).mockResolvedValue(
      makeView(
        {
          revision: "rev-bad",
          warning: "Preferencias inválidas. Se usan valores predeterminados; restablece para guardar de nuevo.",
        },
        "es",
      ),
    );

    render(
      <I18nProvider>
        <TopNav settings={null} user={null} logoutDisabled={false} onLogout={() => {}} />
        <Preferences visible />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe(
        "Invalid preferences. Default values are in use; reset to save again.",
      );
    });
    expect((screen.getByLabelText("Language", { selector: "select" }) as HTMLSelectElement).value).toBe("en");
    expect((screen.getByRole("button", { name: "Save preferences" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("syncs selectedLang when TopNav toggles language and persists updated language on Save", async () => {
    const user = userEvent.setup();
    vi.mocked(userPreferences).mockResolvedValue(makeView({ revision: "rev-1", warning: null }, "es"));
    vi.mocked(saveUserPreferences).mockResolvedValue(makeView({ revision: "rev-2", warning: null }, "en"));

    render(
      <I18nProvider>
        <TopNav settings={null} user={null} logoutDisabled={false} onLogout={() => {}} />
        <Preferences visible />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect((screen.getByRole("button", { name: "Guardar preferencias" }) as HTMLButtonElement).disabled).toBe(false);
    });

    await user.click(screen.getByRole("button", { name: "Idioma" }));
    expect((screen.getByLabelText("Language", { selector: "select" }) as HTMLSelectElement).value).toBe("en");

    await user.click(screen.getByRole("button", { name: "Save preferences" }));
    expect(saveUserPreferences).toHaveBeenCalledWith({
      theme: "light",
      ui_scale: "standard",
      language: "en",
      expected_revision: "rev-1",
    });
    expect((await screen.findByRole("status")).textContent).toBe("Preferences saved.");
  });

  it("translates backend errors reactively via tError on load and save failure", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("easyfab.lang", "en");
    vi.mocked(userPreferences).mockRejectedValueOnce("No se pudieron leer preferencias: disk error");

    const view = render(
      <I18nProvider>
        <TopNav settings={null} user={null} logoutDisabled={false} onLogout={() => {}} />
        <Preferences visible />
      </I18nProvider>,
    );

    expect((await screen.findByRole("alert")).textContent).toBe("Could not read preferences: disk error");
    await user.click(screen.getByRole("button", { name: "Language" }));
    expect(screen.getByRole("alert").textContent).toBe("No se pudieron leer preferencias: disk error");
    view.unmount();

    window.localStorage.setItem("easyfab.lang", "es");
    vi.mocked(userPreferences).mockResolvedValueOnce(makeView({ revision: "rev-1", warning: null }, "en"));
    vi.mocked(saveUserPreferences).mockRejectedValue("Las preferencias cambiaron. Actualiza antes de guardar.");

    render(
      <I18nProvider>
        <TopNav settings={null} user={null} logoutDisabled={false} onLogout={() => {}} />
        <Preferences visible />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect((screen.getByRole("button", { name: "Save preferences" }) as HTMLButtonElement).disabled).toBe(false);
    });

    await user.click(screen.getByRole("button", { name: "Save preferences" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Preferences changed. Refresh before saving.");

    await user.click(screen.getByRole("button", { name: "Language" }));
    expect(screen.getByRole("alert").textContent).toBe("Las preferencias cambiaron. Actualiza antes de guardar.");
  });

  it("restores backend default language ('es') on explicit Reset", async () => {
    const user = userEvent.setup();
    vi.mocked(userPreferences).mockResolvedValue(makeView({ revision: "rev-1", warning: null }, "en"));
    vi.mocked(resetUserPreferences).mockResolvedValue(makeView({ revision: null, warning: null }, "es"));

    render(
      <I18nProvider>
        <LangReader />
        <Preferences visible />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("active-lang").textContent).toBe("en");
    });

    await user.click(screen.getByRole("button", { name: "Reset preferences" }));
    expect(resetUserPreferences).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("active-lang").textContent).toBe("es");
    expect((screen.getByLabelText("Idioma") as HTMLSelectElement).value).toBe("es");
    expect(screen.getByRole("status").textContent).toBe("Preferencias restablecidas.");
  });

  it("preserves a post-mount TopNav toggle when an in-flight userPreferences() resolves afterward (PROBE 5b)", async () => {
    const user = userEvent.setup();
    let resolveLoad!: (value: PreferencesView) => void;
    vi.mocked(userPreferences).mockImplementation(
      () => new Promise<PreferencesView>(resolve => { resolveLoad = resolve; }),
    );

    render(
      <I18nProvider>
        <LangReader />
        <TopNav settings={null} user={null} logoutDisabled={false} onLogout={() => {}} />
        <Preferences visible />
      </I18nProvider>,
    );

    // Toggle TopNav es -> en while userPreferences() is still in-flight
    await user.click(screen.getByRole("button", { name: "Idioma" }));
    expect(screen.getByTestId("active-lang").textContent).toBe("en");

    // Resolve saved preferences from backend with language: "es"
    resolveLoad(makeView({ revision: "rev-1", warning: null }, "es"));

    await waitFor(() => {
      expect((screen.getByRole("button", { name: "Save preferences" }) as HTMLButtonElement).disabled).toBe(false);
    });
    expect(screen.getByTestId("active-lang").textContent).toBe("en");
    expect((screen.getByLabelText("Language", { selector: "select" }) as HTMLSelectElement).value).toBe("en");
  });

  it("skips post-await state and setLang updates when Preferences unmounts during save (PROBE 6b)", async () => {
    const user = userEvent.setup();
    vi.mocked(userPreferences).mockResolvedValue(makeView({ revision: "rev-1", warning: null }, "es"));
    let resolveSave!: (value: PreferencesView) => void;
    vi.mocked(saveUserPreferences).mockImplementation(
      () => new Promise<PreferencesView>(resolve => { resolveSave = resolve; }),
    );

    function Harness({ showPreferences }: { showPreferences: boolean }) {
      const { lang, setLang } = useI18n();
      return (
        <div>
          <span data-testid="active-lang">{lang}</span>
          <button type="button" onClick={() => setLang("es")}>force-es</button>
          {showPreferences && <Preferences visible />}
        </div>
      );
    }

    const view = render(
      <I18nProvider>
        <Harness showPreferences />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect((screen.getByRole("button", { name: "Guardar preferencias" }) as HTMLButtonElement).disabled).toBe(false);
    });

    await user.selectOptions(screen.getByLabelText("Idioma"), "en");
    expect(screen.getByTestId("active-lang").textContent).toBe("en");

    await user.click(screen.getByRole("button", { name: "Save preferences" }));
    expect(saveUserPreferences).toHaveBeenCalledTimes(1);

    // Unmount Preferences while saveUserPreferences is still in-flight, and switch I18nProvider back to "es"
    view.rerender(
      <I18nProvider>
        <Harness showPreferences={false} />
      </I18nProvider>,
    );
    await user.click(screen.getByRole("button", { name: "force-es" }));
    expect(screen.getByTestId("active-lang").textContent).toBe("es");

    // Now resolve the in-flight save with language: "en"; unmounted Preferences must NOT flip active-lang back to "en"
    resolveSave(makeView({ revision: "rev-2", warning: null }, "en"));
    await Promise.resolve();
    await Promise.resolve();

    expect(screen.getByTestId("active-lang").textContent).toBe("es");
  });
});
