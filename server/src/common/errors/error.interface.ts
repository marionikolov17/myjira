export interface IAppError {
  code: string;
  status: number;
  message: string;
  details?: IErrorDetails;
}

export interface IErrorDetails {
  fields?: IErrorField[];
  resource?: IResource;
}

export interface IErrorField {
  name: string;
  message: string;
}

export interface IResource {
  resourceName: string;
  resourceId?: string;
}
