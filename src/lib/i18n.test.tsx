// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider, localeForLang, messages, readInitialLang, translateMessage, useI18n } from "./i18n";

function Probe() {
  const { lang, setLang, t, pick, tError } = useI18n();
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="nav">{t("nav.projects")}</span>
      <span data-testid="interp">{t("login.sessionBanner", { name: "Ada", role: t("role.engineer") })}</span>
      <span data-testid="bilingual">{pick("Diseño | Design")}</span>
      <span data-testid="legacy">{pick("Solo español")}</span>
      <span data-testid="err">{tError("Ingresa primero.")}</span>
      <button type="button" onClick={() => setLang("en")}>en</button>
      <button type="button" onClick={() => setLang("es")}>es</button>
    </div>
  );
}

function extractPlaceholders(text: string): string[] {
  return [...text.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map(m => m[1]).sort();
}

describe("i18n", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "";
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("defaults to Spanish and switches to English with bilingual fallback and reactive tError", async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );

    expect(screen.getByTestId("lang").textContent).toBe("es");
    expect(screen.getByTestId("nav").textContent).toBe("Proyectos");
    expect(screen.getByTestId("interp").textContent).toBe("Sesión de Ada · Ingeniero");
    expect(screen.getByTestId("bilingual").textContent).toBe("Diseño");
    expect(screen.getByTestId("legacy").textContent).toBe("Solo español");
    expect(screen.getByTestId("err").textContent).toBe("Ingresa primero.");

    await user.click(screen.getByRole("button", { name: "en" }));

    expect(screen.getByTestId("lang").textContent).toBe("en");
    expect(screen.getByTestId("nav").textContent).toBe("Projects");
    expect(screen.getByTestId("interp").textContent).toBe("Signed in as Ada · Engineer");
    expect(screen.getByTestId("bilingual").textContent).toBe("Design");
    expect(screen.getByTestId("legacy").textContent).toBe("Solo español");
    expect(screen.getByTestId("err").textContent).toBe("Sign in first.");
    expect(document.documentElement.lang).toBe("en");
  });

  it("maintains exact key parity, non-empty values, and matching {param} placeholders across es and en", () => {
    const esKeys = Object.keys(messages.es).sort();
    const enKeys = Object.keys(messages.en).sort();
    expect(esKeys).toEqual(enKeys);

    for (const key of esKeys as Array<keyof typeof messages.es>) {
      const esVal = messages.es[key];
      const enVal = messages.en[key];
      expect(esVal.trim().length, `empty es value for ${key}`).toBeGreaterThan(0);
      expect(enVal.trim().length, `empty en value for ${key}`).toBeGreaterThan(0);
      expect(extractPlaceholders(enVal), `placeholder mismatch for ${key}`).toEqual(extractPlaceholders(esVal));
    }
  });

  it("exposes localeForLang, readInitialLang fallback, and translateMessage interpolation", () => {
    expect(localeForLang("es")).toBe("es-MX");
    expect(localeForLang("en")).toBe("en-US");

    expect(readInitialLang()).toBe("es");
    window.localStorage.setItem("easyfab.lang", "en");
    expect(readInitialLang()).toBe("en");
    window.localStorage.setItem("easyfab.lang", "fr");
    expect(readInitialLang()).toBe("es");

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(readInitialLang()).toBe("es");

    expect(translateMessage("timeline.summary", "en", {
      start: "01 nov",
      end: "07 nov",
      shown: 2,
      total: 5,
      status: "active",
    })).toBe("01 nov — 07 nov · 2 of 5 active projects in period");
    expect(translateMessage("modal.closeWithTitle", "es", { title: "actualizar" })).toBe("Cerrar actualizar");
  });

  it("uses Spanish defaultContext when rendered outside I18nProvider", () => {
    render(<Probe />);
    expect(screen.getByTestId("lang").textContent).toBe("es");
    expect(screen.getByTestId("nav").textContent).toBe("Proyectos");
    expect(screen.getByTestId("err").textContent).toBe("Ingresa primero.");
  });
});
