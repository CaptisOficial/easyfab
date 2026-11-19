// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EvidenceAttachment } from "./EvidenceAttachment";
import { readResultsEvidence } from "../../lib/results-api";
vi.mock("../../lib/results-api", () => ({ readResultsEvidence: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("muestra foto y conserva apertura; un error de imagen deja disponible el nombre", async () => {
  vi.mocked(readResultsEvidence).mockResolvedValue([137, 80, 78, 71]);
  const open = vi.fn();
  const { container } = render(<EvidenceAttachment projectId="synthetic" file={{ id: "photo", name: "Foto.PNG" }} onOpen={open} />);
  await waitFor(() => expect(container.querySelector("img")?.src).toContain("data:image/png;base64,"));
  expect(readResultsEvidence).toHaveBeenCalledWith("synthetic", "photo");
  fireEvent.click(screen.getByRole("button", { name: "Foto.PNG" }));
  expect(open).toHaveBeenCalledOnce();
  fireEvent.error(container.querySelector("img")!);
  expect(container.querySelector("img")).toBeNull();
  expect(screen.getByRole("button", { name: "Foto.PNG" })).toBeTruthy();
});
it("no lee PDF y tolera errores de lectura de fotos", async () => {
  const { rerender, container } = render(<EvidenceAttachment projectId="synthetic" file={{ id: "pdf", name: "Plano.pdf" }} onOpen={vi.fn()} />);
  expect(readResultsEvidence).not.toHaveBeenCalled();
  vi.mocked(readResultsEvidence).mockRejectedValue("Sin acceso");
  rerender(<EvidenceAttachment projectId="synthetic" file={{ id: "photo", name: "Foto.jpg" }} onOpen={vi.fn()} />);
  await waitFor(() => expect(readResultsEvidence).toHaveBeenCalledOnce());
  expect(container.querySelector("img")).toBeNull();
  expect(screen.getByRole("button", { name: "Foto.jpg" })).toBeTruthy();
});
