import { CfnVirtualNode, CfnVirtualGateway } from './appmesh.generated';

/**
 * Enum of supported TLS modes
 */
export enum TlsMode {
  /**
   * Only accept encrypted traffic
   */
  STRICT = 'STRICT',
  /**
   * Accept encrypted and plaintext traffic.
   */
  PERMISSIVE = 'PERMISSIVE',
  /**
   * TLS is disabled, only accept plaintext traffic.
   */
  DISABLED = 'DISABLED',
}

/**
 * Represents a TLS certificate
 */
export abstract class TlsCertificate {

  /**
   * Returns TLS certificate based provider.
   */
  public abstract bind(): CfnVirtualNode.ListenerTlsCertificateProperty
  | CfnVirtualGateway.VirtualGatewayListenerTlsCertificateProperty;

}

/**
 * Represents a ACM provided TLS certificate
 */
export class AcmTlsCertificate extends TlsCertificate {

  /**
   * The ARN of the ACM certificate
   */
  readonly certificateArn: string;

  constructor(props: ACMCertificateOptions) {
    super();
    this.certificateArn = props.acmCertificate;
  }

  bind(): CfnVirtualNode.ListenerTlsCertificateProperty | CfnVirtualGateway.VirtualGatewayListenerTlsCertificateProperty {
    return {
      acm: {
        certificateArn: this.certificateArn,
      },
    };
  }
}

/**
 * Represents a file provided TLS certificate
 */
export class FileTlsCertificate extends TlsCertificate {
  /**
   * The file path of the certificate chain file.
   */
  readonly certificateChain: string;
  /**
   * The file path of the private key file.
   */
  readonly privateKey: string;

  constructor(props: FileCertificateOptions) {
    super();
    this.certificateChain = props.certificateChain;
    this.privateKey = props.privateKey;
  }

  bind(): CfnVirtualNode.ListenerTlsCertificateProperty | CfnVirtualGateway.VirtualGatewayListenerTlsCertificateProperty {
    return {
      file: {
        certificateChain: this.certificateChain,
        privateKey: this.privateKey,
      },
    };
  }
}

/**
 * ACM Certificate Properties
 */
export interface ACMCertificateOptions {
  /**
   * The ACM certificate
   */
  readonly acmCertificate: string;
}

/**
 * File Certificate Properties
 */
export interface FileCertificateOptions {
  /**
   * The file path of the certificate chain file.
   */
  readonly certificateChain: string;
  /**
   * The file path of the private key file.
   */
  readonly privateKey: string;
}
