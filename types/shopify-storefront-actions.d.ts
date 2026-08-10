/*
  Shopify storefront actions types

  This file provides editor types for Shopify's standard storefront actions exposed on the global Shopify object.
*/

import type { CartLinesUpdateResult } from "@shopify/standard-events";

interface ShopifyCartAttributeInput {
  key: string;
  value: string;
}

interface ShopifyCartLineInput {
  id?: string;
  merchandiseId?: string;
  quantity: number;
  attributes?: ShopifyCartAttributeInput[];
  sellingPlanId?: string;
}

interface ShopifyUpdateCartPayload {
  cartId?: string;
  lines?: ShopifyCartLineInput[];
  note?: string;
  discountCodes?: string[];
  attributes?: ShopifyCartAttributeInput[];
}

interface ShopifyUpdateCartEventOptions {
  context?: "product" | "cart" | "dialog" | "standard-action";
  detail?: Record<string, unknown>;
}

interface ShopifyUpdateCartOptions {
  signal?: AbortSignal;
  event?: ShopifyUpdateCartEventOptions;
}

interface ShopifyUpdateCartEventTargetMeta {
  type:
    | "shopify:cart:lines-update"
    | "shopify:cart:note-update"
    | "shopify:cart:attributes-update"
    | "shopify:cart:discount-update"
    | "shopify:cart:error";
  action?: "add" | "remove" | "update";
}

interface ShopifyUpdateCartConfiguration {
  eventTarget: (meta: ShopifyUpdateCartEventTargetMeta) => EventTarget | null;
  handler?: (
    defaultHandler: () => Promise<CartLinesUpdateResult>,
    payload: ShopifyUpdateCartPayload,
    options?: ShopifyUpdateCartOptions,
  ) => Promise<CartLinesUpdateResult>;
}

interface ShopifyUpdateCartAction {
  (payload: ShopifyUpdateCartPayload, options?: ShopifyUpdateCartOptions): Promise<CartLinesUpdateResult>;
  configure(configuration: ShopifyUpdateCartConfiguration): boolean;
}

interface ShopifyOpenCartConfiguration {
  handler: (defaultHandler: () => Promise<void>) => void | Promise<void>;
}

interface ShopifyOpenCartAction {
  (): Promise<void>;
  configure(configuration: ShopifyOpenCartConfiguration): boolean;
}

interface ShopifyGetCartPayload {
  cartId?: string;
}

interface ShopifyGetCartOptions {
  signal?: AbortSignal;
}

interface ShopifyGetCartAction {
  (
    payload?: ShopifyGetCartPayload,
    options?: ShopifyGetCartOptions,
  ): Promise<{
    cart: CartLinesUpdateResult["cart"];
  }>;
}

interface ShopifyStorefrontActions {
  updateCart: ShopifyUpdateCartAction;
  openCart: ShopifyOpenCartAction;
  getCart: ShopifyGetCartAction;
}

interface ShopifyGlobal {
  actions?: ShopifyStorefrontActions;
  [property: string]: unknown;
}

declare global {
  var Shopify: ShopifyGlobal | undefined;

  interface Window {
    Shopify?: ShopifyGlobal;
  }
}

export {};
