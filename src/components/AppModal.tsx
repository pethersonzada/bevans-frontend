import { useThemeRevision } from '../hooks/useThemeRevision';
import { Modal, type ModalProps } from 'react-native';
import { AppAlertModalLayer, useModalAlertClose } from '../contexts/AppAlertContext';

export function AppModal({ children, ...props }: ModalProps) {
    useThemeRevision();
    const close = useModalAlertClose();
    return <Modal {...props} onRequestClose={event => close(() => props.onRequestClose?.(event))}>{props.visible && <AppAlertModalLayer>{children}</AppAlertModalLayer>}</Modal>;
}
