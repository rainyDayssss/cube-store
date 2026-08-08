import { describe, expect, it } from "vitest";
import { routeMode } from "./route-mode";

describe("routeMode (ticket 02)", () => {
  describe("storefront mode", () => {
    it("blocks /admin and its children", () => {
      expect(routeMode("/admin", "storefront")).toBe("block");
      expect(routeMode("/admin/orders", "storefront")).toBe("block");
      expect(routeMode("/admin/products/1", "storefront")).toBe("block");
    });

    it("blocks /auth and its children", () => {
      expect(routeMode("/auth", "storefront")).toBe("block");
      expect(routeMode("/auth/login", "storefront")).toBe("block");
      expect(routeMode("/auth/forgot-password", "storefront")).toBe("block");
    });

    it("allows every public storefront path", () => {
      for (const path of ["/", "/products", "/products/cube", "/cart", "/checkout"]) {
        expect(routeMode(path, "storefront")).toBe("allow");
      }
    });
  });

  describe("admin mode", () => {
    it("allows /admin and /auth paths", () => {
      expect(routeMode("/admin", "admin")).toBe("allow");
      expect(routeMode("/admin/orders", "admin")).toBe("allow");
      expect(routeMode("/auth/login", "admin")).toBe("allow");
      expect(routeMode("/auth", "admin")).toBe("allow");
    });

    it("blocks everything else, including the host root", () => {
      for (const path of ["/", "/products", "/products/cube", "/cart", "/checkout"]) {
        expect(routeMode(path, "admin")).toBe("block");
      }
    });
  });

  describe("unset mode", () => {
    it("blocks nothing — single-deployment behaviour is preserved", () => {
      for (const path of ["/", "/products", "/cart", "/checkout", "/admin", "/admin/orders", "/auth/login"]) {
        expect(routeMode(path, undefined)).toBe("allow");
      }
    });

    it("treats an unknown app mode value as unset (inert)", () => {
      expect(routeMode("/admin", "production" as string)).toBe("allow");
    });
  });

  describe("prefix matching", () => {
    it("matches lookalike prefixes like /administrator (startsWith semantics)", () => {
      expect(routeMode("/administrator", "storefront")).toBe("block");
      expect(routeMode("/administrator", "admin")).toBe("allow");
    });
  });
});
