export interface CheckoutData {
  store: {
    name: string;
    settings: {
      primary_color: string;
      secondary_color: string;
      dark_mode: boolean;
      logo_url: string | null;
      banner_url: string | null;
      button_text?: string;
      enable_order_bump: boolean;
    };
    gateways: { provider: string }[];
  };
  product: {
    id: number;
    name: string;
    description?: string | null;
    price: number;
    image_url?: string | null;
  };
}

export interface CheckoutProcessResponse {
  order_id?: number;
  status?: string;
  message?: string;
  pix_qrcode?: string;
  pix_copia_cola?: string;
}
