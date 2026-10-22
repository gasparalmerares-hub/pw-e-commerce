export const metadata = {
  title: "Política de privacidad | Camisetas Zeus",
  description: "Qué datos personales usa Camisetas Zeus, para qué y cómo pedir que los modifiquemos o borremos.",
};

const secciones = [
  {
    titulo: "Quiénes somos",
    texto: [
      "Camisetas Zeus es una tienda online de camisetas de rugby con base en La Plata, Buenos Aires. Somos responsables de los datos personales que nos das cuando comprás o nos escribís a través de camisetaszeus.com.",
    ],
  },
  {
    titulo: "Qué datos pedimos y para qué",
    texto: [
      "Cuando hacés un pedido te pedimos nombre, email, teléfono y dirección de entrega. Los usamos para preparar y enviar tu pedido, confirmarte el pago y comunicarnos con vos por cualquier consulta sobre la compra.",
      "Si empezás a completar tus datos en \"Finalizar compra\" y no terminás la compra, podemos guardarlos junto con los productos que elegiste para escribirte y ayudarte a completarla.",
      "Si nos escribís por el formulario de contacto o por WhatsApp, usamos tus datos solo para responderte.",
      "Los datos de tu tarjeta los carga y procesa directamente Mercado Pago: nosotros no los vemos ni los guardamos.",
    ],
  },
  {
    titulo: "Con quién los compartimos",
    texto: [
      "Solo con los servicios que necesitamos para que la tienda funcione: Mercado Pago (cobros), la empresa de correo que hace el envío, el servicio con el que te enviamos los emails de confirmación y los proveedores donde se aloja la web y se guardan los pedidos.",
      "No vendemos ni cedemos tus datos a terceros para otros fines.",
    ],
  },
  {
    titulo: "Cookies, medición y publicidad",
    texto: [
      "La web usa cookies y tecnologías similares, que son pequeños archivos que guarda tu navegador. Algunas son necesarias, por ejemplo para recordar tu carrito.",
      "Otras las usan Meta (Facebook e Instagram), TikTok y Google Analytics para medir cuántas personas visitan la web, qué productos miran y si una compra vino de un anuncio, y así mostrar publicidad a personas a las que les pueden interesar nuestras camisetas. Cuando se confirma una compra, les informamos esa compra junto con datos de contacto protegidos (cifrados) para que puedan relacionarla con sus anuncios.",
      "Podés borrar o bloquear las cookies desde la configuración de tu navegador, y ajustar los anuncios que ves desde la configuración de privacidad de cada red social.",
    ],
  },
  {
    titulo: "Cuánto tiempo los guardamos",
    texto: [
      "Guardamos los datos de tus pedidos mientras sean necesarios para gestionar la compra, los envíos, los cambios y nuestras obligaciones contables e impositivas.",
    ],
  },
  {
    titulo: "Tus derechos",
    texto: [
      "Podés pedirnos en cualquier momento que te digamos qué datos tuyos tenemos, que los corrijamos o que los borremos. Escribinos por WhatsApp al +54 9 221 622-0145 o por email a camisetaszeus@hotmail.com y te respondemos a la brevedad.",
      "El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto, conforme lo establecido en el artículo 14, inciso 3 de la Ley N° 25.326.",
      "La Agencia de Acceso a la Información Pública, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.",
    ],
  },
  {
    titulo: "Cambios en esta política",
    texto: [
      "Si cambiamos algo de esta política, lo publicamos en esta misma página con la fecha de actualización.",
    ],
  },
];

export default function PoliticaDePrivacidadPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">Política de privacidad</h1>
      <p className="text-sm text-gray-500 mt-1 mb-8">Última actualización: 22 de octubre de 2026</p>
      <div className="flex flex-col gap-8">
        {secciones.map((s) => (
          <section key={s.titulo}>
            <h2 className="text-lg font-bold text-gray-900 mb-2">{s.titulo}</h2>
            <div className="flex flex-col gap-3 text-gray-700 leading-relaxed">
              {s.texto.map((p) => <p key={p}>{p}</p>)}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
