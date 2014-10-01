package ee.cyber.sdsb.common.signature;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import org.apache.xml.security.signature.XMLSignatureInput;
import org.apache.xml.security.utils.resolver.ResourceResolverException;
import org.apache.xml.security.utils.resolver.ResourceResolverSpi;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.w3c.dom.Attr;

import ee.cyber.sdsb.common.CodedException;
import ee.cyber.sdsb.common.hashchain.HashChainBuilder;
import ee.cyber.sdsb.common.util.MessageFileNames;

import static ee.cyber.sdsb.common.ErrorCodes.X_INTERNAL_ERROR;
import static ee.cyber.sdsb.common.util.CryptoUtils.calculateDigest;
import static ee.cyber.sdsb.common.util.CryptoUtils.getDigestAlgorithmId;
import static ee.cyber.sdsb.common.util.MessageFileNames.*;

/**
 * This class handles the (batch) signature creation. After requests
 * have been added to the context, the signature is created.
 *
 * Depending on the amount of input hashes (one hash for a single message,
 * multiple hashes for a single message with attachments etc.) the result
 * is a XML signature with one referenced message or a referenced hash chain
 * result with corresponding hash chains.
 */
class SignatureCtx {

    private static final Logger LOG =
            LoggerFactory.getLogger(SignatureCtx.class);

    private final List<SigningRequest> requests = new ArrayList<>();

    private final String signatureAlgorithmId;

    private String hashChainResult;
    private String[] hashChains;

    private SignatureXmlBuilder builder;

    SignatureCtx(String signatureAlgorithmId) {
        this.signatureAlgorithmId = signatureAlgorithmId;
    }

    String getSignatureAlgorithmId() {
        return signatureAlgorithmId;
    }

    synchronized void add(SigningRequest request) {
        requests.add(request);
    }

    synchronized String createSignatureXml(byte[] signatureValue)
            throws Exception {
        return builder.createSignatureXml(signatureValue);
    }

    synchronized SignatureData createSignatureData(String signature,
            int signerIndex) {
        return new SignatureData(signature, hashChainResult,
                hashChains != null ? hashChains[signerIndex] : null);
    }

    synchronized byte[] getDataToBeSigned() throws Exception {
        LOG.trace("getDataToBeSigned(requests = {})", requests.size());

        if (requests.size() == 0) {
            throw new CodedException(X_INTERNAL_ERROR,
                    "No requests in signing context");
        }

        SigningRequest firstRequest = requests.get(0);

        builder = new SignatureXmlBuilder(firstRequest, getHashAlgorithmId());

        // If only one single hash (message), then no hash chain
        if (requests.size() == 1 && firstRequest.isSingleMessage()) {
            return builder.createDataToBeSigned(MESSAGE,
                    createResourceResolver(
                            firstRequest.getParts().get(0).getData()));
        }

        buildHashChain();

        byte[] hashChainResultBytes =
                hashChainResult.getBytes(StandardCharsets.UTF_8);
        return builder.createDataToBeSigned(SIG_HASH_CHAIN_RESULT,
                createResourceResolver(hashChainResultBytes));
    }

    private String getHashAlgorithmId() throws Exception {
        return getDigestAlgorithmId(signatureAlgorithmId);
    }

    private void buildHashChain() throws Exception {
        LOG.trace("buildHashChain()");

        HashChainBuilder hashChainBuilder = new HashChainBuilder(
                getDigestAlgorithmId(signatureAlgorithmId));

        for (SigningRequest request : requests) {
            hashChainBuilder.addInputHash(getHashChainInputs(request));
        }

        hashChainBuilder.finishBuilding();

        hashChainResult = hashChainBuilder.getHashChainResult(SIG_HASH_CHAIN);
        hashChains = hashChainBuilder.getHashChains(MESSAGE);
    }

    private static byte[][] getHashChainInputs(SigningRequest request)
            throws Exception {
        List<MessagePart> parts = request.getParts();

        byte[][] result = new byte[parts.size()][];
        for (int i = 0; i < parts.size(); i++) {
            MessagePart part = parts.get(i);

            // Assuming that message is raw data, we need to hash it
            if (MessageFileNames.MESSAGE.equals(part.getName())) {
                result[i] = calculateHash(part);
            } else {
                result[i] = part.getData(); // attachment
            }
        }

        return result;
    }

    private static byte[] calculateHash(MessagePart part) throws Exception {
        return calculateDigest(part.getHashAlgoId(), part.getData());
    }

    /**
     * This resource resolver will provide the message or hash chain data
     * to be digested.
     */
    private ResourceResolverSpi createResourceResolver(final byte[] data) {
        if (data == null) {
            throw new IllegalArgumentException("Data must not be null");
        }

        return new ResourceResolverSpi() {
            @Override
            public boolean engineCanResolve(Attr uri, String baseUri) {
                switch (uri.getValue()) {
                    case MessageFileNames.MESSAGE:
                    case MessageFileNames.SIG_HASH_CHAIN_RESULT:
                        return true;
                    default:
                        return false;
                }
            }

            @Override
            public XMLSignatureInput engineResolve(Attr uri, String baseUri)
                    throws ResourceResolverException {
                return new XMLSignatureInput(data);
            }
        };
    }

}