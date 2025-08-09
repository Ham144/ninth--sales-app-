export default function ModalConfirmation({
  onConfirm,
  onCancel,
  title,
  message,
}) {
  return (
    <>
      <dialog
        id="modal_confirmation"
        className="modal modal-bottom sm:modal-middle"
      >
        <div className="modal-box bg-base-100 shadow-xl rounded-lg">
          <form method="dialog">
            <button
              type="button"
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              onClick={onCancel}
            >
              ✕
            </button>
          </form>
          <p className="font-bold text-lg">{title}</p>
          <p className="py-4 text-base-content text-opacity-80">{message}</p>
          <div className="modal-action mt-4 flex gap-x-2">
            <form method="dialog" className="contents">
              <button
                className="btn btn-ghost hover:bg-base-200"
                onClick={onCancel}
              >
                Batal
              </button>
              <button
                className="btn text-white btn-primary "
                onClick={onConfirm}
              >
                Konfirmasi
              </button>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="button" onClick={onCancel}>
            close
          </button>
        </form>
      </dialog>
    </>
  );
}
