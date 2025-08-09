import httpntlm from "httpntlm";

export async function fetchData({ xml, username, password, url, SOAPAction }) {
  return new Promise((resolve, reject) => {
    httpntlm.post(
      {
        url,
        username,
        password,
        workstation: "",
        domain: "",
        body: xml,
        headers: {
          "Content-Type": 'text/xml; charset="UTF-8"',
          SOAPAction: SOAPAction,
        },
      },
      (err, res) => {
        if (err) return reject(err);

        resolve(res.body);
      }
    );
  });
}
