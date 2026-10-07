export interface Brand {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBrandRequest {
  name: string;
  isActive: boolean;
}

export interface UpdateBrandRequest extends CreateBrandRequest {}
