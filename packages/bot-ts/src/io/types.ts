export interface TCTXoptions {
    media?: null | string;
    buttons?: any[];
    capture?: boolean;
    child?: null | any;
    delay?: number;
    idle?: null | any;
    ref?: null | string;
    nested?: any[];
    keyword?: string | string[];
    callback?: boolean;
}

export interface Callbacks {
    [key: string]: () => void;
}

export interface TContext {
    ref: string;
    keyword: string;
    answer: string | string[];
    refSerialize?: string;
    options: TCTXoptions;
    callbacks: Callbacks;
    json: object
}

export interface TFlow {
    ctx: TContext;
    ref: string;
    addAnswer: (answer: string) => void;
    addAction: (action: any) => void;
    toJson: () => TContext;
}

